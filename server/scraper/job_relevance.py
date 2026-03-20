"""LLM-based job relevance pre-filtering

Scores job descriptions to filter out irrelevant positions before
they reach the application board.

Usage:
    from job_relevance import JobRelevanceScorer

    scorer = JobRelevanceScorer(api_key, base_url, model, user_criteria)
    score = scorer.score_job(title, description)
    if score.is_relevant:
        # Add to database
"""

from typing import Optional
from pydantic import BaseModel, Field
import instructor
from openai import OpenAI


class RelevanceScore(BaseModel):
    """Structured relevance assessment for a job posting."""
    overall_score: int = Field(..., ge=0, le=100, description="Overall relevance score 0-100")
    is_relevant: bool = Field(..., description="True if score >= threshold (default 60)")
    reasons: list[str] = Field(..., description="Specific reasons for score (positive or negative)")
    red_flags: list[str] = Field(default_factory=list, description="Deal-breakers: 'unpaid', 'MLM', 'commission-only', etc.")
    match_highlights: list[str] = Field(default_factory=list, description="Specific matches to user criteria")


class JobRelevanceScorer:
    """
    Filter jobs before they hit the board using LLM-based relevance scoring.

    Example user criteria:
    {
        "target_roles": ["Software Engineer", "ML Engineer", "Backend Developer"],
        "required_skills": ["Python", "APIs"],
        "preferred_skills": ["LLM", "PyTorch", "FastAPI"],
        "exclude_keywords": ["sales", "unpaid", "commission"],
        "min_experience_years": 0,  # Entry-level OK
        "max_experience_years": 3,  # Not senior positions
        "remote_only": False,
        "location_preferences": ["San Francisco", "New York", "Remote"],
    }
    """

    def __init__(
        self,
        api_key: str,
        user_criteria: dict,
        base_url: Optional[str] = None,
        model: str = "gpt-4o-mini",
        threshold: int = 60,
    ):
        self.client = instructor.patch(OpenAI(api_key=api_key, base_url=base_url))
        self.model = model
        self.user_criteria = user_criteria
        self.threshold = threshold

    def score_job(self, title: str, description: str, company: str = "") -> RelevanceScore:
        """Score a job for relevance based on user criteria.

        Returns RelevanceScore with overall_score, is_relevant, reasons, etc.
        """
        prompt = self._build_prompt(title, description, company)

        try:
            score = self.client.chat.completions.create(
                model=self.model,
                response_model=RelevanceScore,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a job relevance evaluator. Assess job postings against user criteria."
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,  # Lower temperature for consistency
            )

            # Apply threshold
            score.is_relevant = score.overall_score >= self.threshold

            return score

        except Exception as e:
            # Fallback: heuristic scoring
            return self._heuristic_fallback(title, description, company, str(e))

    def _build_prompt(self, title: str, description: str, company: str) -> str:
        """Build evaluation prompt with user criteria."""
        criteria_text = self._format_criteria()

        return f"""Evaluate this job posting for relevance to the candidate's search criteria.

**Job Title:** {title}
**Company:** {company}
**Description:**
{description[:1500]}  # Truncate for token limits

**Candidate Criteria:**
{criteria_text}

**Scoring Guidelines:**
- 80-100: Excellent match (required skills + role alignment)
- 60-79: Good match (most criteria met, minor gaps)
- 40-59: Partial match (some criteria met, notable gaps)
- 0-39: Poor match (major misalignment or red flags)

**Red Flags (auto-reject):**
- Unpaid internships
- Commission-only roles
- MLM/pyramid schemes
- Requires 5+ years for "entry-level"
- Location mismatch if remote_only=true

**Output:**
Provide:
1. overall_score (0-100)
2. is_relevant (true/false based on threshold)
3. reasons (list of specific factors)
4. red_flags (if any deal-breakers found)
5. match_highlights (specific matches to criteria)
"""

    def _format_criteria(self) -> str:
        """Format user criteria for prompt."""
        lines = []

        if "target_roles" in self.user_criteria:
            lines.append(f"Target Roles: {', '.join(self.user_criteria['target_roles'])}")

        if "required_skills" in self.user_criteria:
            lines.append(f"Required Skills: {', '.join(self.user_criteria['required_skills'])}")

        if "preferred_skills" in self.user_criteria:
            lines.append(f"Preferred Skills: {', '.join(self.user_criteria['preferred_skills'])}")

        if "exclude_keywords" in self.user_criteria:
            lines.append(f"Exclude Keywords: {', '.join(self.user_criteria['exclude_keywords'])}")

        if "min_experience_years" in self.user_criteria:
            lines.append(f"Min Experience: {self.user_criteria['min_experience_years']} years")

        if "max_experience_years" in self.user_criteria:
            lines.append(f"Max Experience: {self.user_criteria['max_experience_years']} years")

        if self.user_criteria.get("remote_only"):
            lines.append("Remote Only: Yes")

        if "location_preferences" in self.user_criteria:
            lines.append(f"Preferred Locations: {', '.join(self.user_criteria['location_preferences'])}")

        return "\n".join(lines)

    def _heuristic_fallback(self, title: str, description: str, company: str, error: str) -> RelevanceScore:
        """Fallback heuristic scoring if LLM fails."""
        score = 50  # Neutral baseline
        reasons = []
        red_flags = []
        highlights = []

        title_lower = title.lower()
        desc_lower = description.lower()

        # Check required skills
        if "required_skills" in self.user_criteria:
            matched_skills = [s for s in self.user_criteria["required_skills"] if s.lower() in desc_lower]
            if matched_skills:
                score += len(matched_skills) * 10
                highlights.extend(matched_skills)
                reasons.append(f"Matches required skills: {', '.join(matched_skills)}")
            else:
                score -= 20
                reasons.append("Missing required skills")

        # Check exclude keywords
        if "exclude_keywords" in self.user_criteria:
            excluded = [kw for kw in self.user_criteria["exclude_keywords"] if kw.lower() in desc_lower or kw.lower() in title_lower]
            if excluded:
                score -= 30
                red_flags.extend(excluded)
                reasons.append(f"Contains excluded keywords: {', '.join(excluded)}")

        # Check target roles
        if "target_roles" in self.user_criteria:
            role_match = any(role.lower() in title_lower for role in self.user_criteria["target_roles"])
            if role_match:
                score += 20
                reasons.append("Title matches target role")
            else:
                score -= 10

        # Common red flags
        if any(flag in desc_lower for flag in ["unpaid", "commission only", "no salary"]):
            red_flags.append("Unpaid or commission-only")
            score = min(score, 30)

        score = max(0, min(100, score))

        reasons.append(f"(Heuristic fallback due to LLM error: {error[:50]})")

        return RelevanceScore(
            overall_score=score,
            is_relevant=score >= self.threshold,
            reasons=reasons,
            red_flags=red_flags,
            match_highlights=highlights,
        )


def should_auto_filter(score: RelevanceScore) -> bool:
    """Determine if job should be auto-filtered to 'filtered-out' state."""
    return not score.is_relevant or len(score.red_flags) > 0
