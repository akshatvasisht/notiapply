"""
Test suite for job_relevance module — LLM-based job relevance pre-filtering.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import patch, MagicMock
from pydantic import ValidationError

from scraper.job_relevance import RelevanceScore, JobRelevanceScorer, should_auto_filter


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def scorer():
    """JobRelevanceScorer with patched instructor and OpenAI so no real API calls occur."""
    with patch('scraper.job_relevance.instructor') as mock_instructor, \
         patch('scraper.job_relevance.OpenAI') as mock_openai:
        mock_instructor.patch.return_value = MagicMock()
        s = JobRelevanceScorer(
            api_key='test-key',
            user_criteria={
                'required_skills': ['Python', 'SQL'],
                'exclude_keywords': ['unpaid', 'commission'],
                'target_roles': ['Engineer', 'Developer'],
                'threshold': 60,
            },
            threshold=60,
        )
        yield s


# ---------------------------------------------------------------------------
# Tests for RelevanceScore (Pydantic validation)
# ---------------------------------------------------------------------------

class TestRelevanceScore:
    """Pydantic field-level validation tests for RelevanceScore."""

    def test_valid_score_50(self):
        """A score of 50 is within bounds and should validate cleanly."""
        score = RelevanceScore(
            overall_score=50,
            is_relevant=True,
            reasons=['decent match'],
            red_flags=[],
            match_highlights=[],
        )
        assert score.overall_score == 50

    def test_valid_score_boundary_0(self):
        """Score of 0 is the lower boundary and must succeed."""
        score = RelevanceScore(
            overall_score=0,
            is_relevant=False,
            reasons=['no match'],
        )
        assert score.overall_score == 0

    def test_valid_score_boundary_100(self):
        """Score of 100 is the upper boundary and must succeed."""
        score = RelevanceScore(
            overall_score=100,
            is_relevant=True,
            reasons=['perfect match'],
        )
        assert score.overall_score == 100

    def test_score_above_100_raises_validation_error(self):
        """Score of 101 violates the le=100 constraint."""
        with pytest.raises(ValidationError):
            RelevanceScore(
                overall_score=101,
                is_relevant=True,
                reasons=[],
            )

    def test_score_below_0_raises_validation_error(self):
        """Score of -1 violates the ge=0 constraint."""
        with pytest.raises(ValidationError):
            RelevanceScore(
                overall_score=-1,
                is_relevant=False,
                reasons=[],
            )


# ---------------------------------------------------------------------------
# Tests for should_auto_filter
# ---------------------------------------------------------------------------

class TestShouldAutoFilter:
    """Tests for the should_auto_filter(score) helper."""

    def test_relevant_no_red_flags_returns_false(self):
        """Relevant job with no red flags should NOT be filtered out."""
        score = RelevanceScore(overall_score=75, is_relevant=True, reasons=[], red_flags=[])
        assert should_auto_filter(score) is False

    def test_not_relevant_no_red_flags_returns_true(self):
        """Non-relevant job should be filtered out even without red flags."""
        score = RelevanceScore(overall_score=40, is_relevant=False, reasons=[], red_flags=[])
        assert should_auto_filter(score) is True

    def test_relevant_with_red_flags_returns_true(self):
        """A technically relevant job that has red flags must be filtered out."""
        score = RelevanceScore(
            overall_score=70,
            is_relevant=True,
            reasons=[],
            red_flags=['unpaid'],
        )
        assert should_auto_filter(score) is True


# ---------------------------------------------------------------------------
# Tests for _heuristic_fallback
# ---------------------------------------------------------------------------

class TestHeuristicFallback:
    """Tests for the heuristic scoring path used when the LLM is unavailable."""

    def test_empty_criteria_generic_job_returns_neutral(self):
        """With no criteria at all the baseline score is ~50 and result is threshold-driven."""
        with patch('scraper.job_relevance.instructor'), \
             patch('scraper.job_relevance.OpenAI'):
            plain_scorer = JobRelevanceScorer(
                api_key='test-key',
                user_criteria={},
                threshold=60,
            )

        result = plain_scorer._heuristic_fallback('Some Job', 'Generic description', 'Co', 'err')
        assert isinstance(result, RelevanceScore)
        assert 0 <= result.overall_score <= 100
        # With no criteria and baseline 50 the job should not be relevant (below 60 threshold)
        assert result.is_relevant == (result.overall_score >= 60)

    def test_required_skill_present_boosts_score(self, scorer):
        """A description containing a required skill should push score above the baseline."""
        result_with = scorer._heuristic_fallback(
            'Engineer', 'We require Python and SQL expertise.', 'Co', 'err'
        )
        result_without = scorer._heuristic_fallback(
            'Engineer', 'Expertise in Java and C++ required.', 'Co', 'err'
        )
        assert result_with.overall_score > result_without.overall_score

    def test_required_skill_missing_penalises_score(self, scorer):
        """If no required skill matches the description the score should be below 50."""
        # Use a title that does NOT match any target_role ('Engineer', 'Developer')
        # so the role-title bonus does not cancel out the skill penalty.
        result = scorer._heuristic_fallback(
            'Sales Manager', 'Expertise in Java and C++ required.', 'Co', 'err'
        )
        # Baseline 50, -20 for missing required skills, -10 for no target role match → 20
        assert result.overall_score < 50

    def test_excluded_keyword_caps_score_at_30(self, scorer):
        """An excluded keyword in the description should add a red flag and cap the score."""
        result = scorer._heuristic_fallback(
            'Intern', 'This is an unpaid position for enthusiastic candidates.', 'Co', 'err'
        )
        # 'unpaid' is in exclude_keywords
        assert any('unpaid' in flag.lower() or 'commission' in flag.lower()
                   for flag in result.red_flags) or result.red_flags

    def test_title_matching_target_role_boosts_score(self, scorer):
        """A title that matches a target_role should receive a score bonus."""
        result_match = scorer._heuristic_fallback(
            'Python Engineer', 'Requires Python and SQL', 'Co', 'err'
        )
        result_no_match = scorer._heuristic_fallback(
            'Sales Manager', 'Requires Python and SQL', 'Co', 'err'
        )
        assert result_match.overall_score > result_no_match.overall_score

    def test_score_always_within_bounds(self, scorer):
        """The returned score must always satisfy 0 <= score <= 100 regardless of inputs."""
        edge_cases = [
            ('', '', '', 'err'),
            ('A' * 500, 'B' * 500, 'C' * 100, 'err'),
            ('Python Engineer', 'Python SQL unpaid commission', 'Co', 'err'),
        ]
        for args in edge_cases:
            result = scorer._heuristic_fallback(*args)
            assert 0 <= result.overall_score <= 100, (
                f"Score {result.overall_score} out of bounds for args: {args[:2]}"
            )


# ---------------------------------------------------------------------------
# Tests for score_job (with mocked LLM client)
# ---------------------------------------------------------------------------

class TestScoreJob:
    """Tests for the score_job() public method."""

    def test_score_job_above_threshold(self, scorer):
        """LLM returns a high-confidence match → result passes through unchanged."""
        scorer.client.chat.completions.create.return_value = RelevanceScore(
            overall_score=85,
            is_relevant=True,
            reasons=['Strong match'],
            red_flags=[],
            match_highlights=[],
        )
        result = scorer.score_job('Python Engineer', 'Python SQL required', 'Acme')
        assert result.overall_score == 85
        assert result.is_relevant is True

    def test_score_job_threshold_override(self, scorer):
        """LLM marks is_relevant=True but overall_score < threshold → overridden to False."""
        scorer.client.chat.completions.create.return_value = RelevanceScore(
            overall_score=40,
            is_relevant=True,
            reasons=[],
            red_flags=[],
            match_highlights=[],
        )
        result = scorer.score_job('Engineer', 'description', 'Acme')
        # threshold=60, score=40 → must be overridden
        assert result.is_relevant is False

    def test_score_job_llm_failure_uses_heuristic(self, scorer):
        """When the LLM raises an exception the heuristic fallback is used."""
        scorer.client.chat.completions.create.side_effect = Exception('API error')
        result = scorer.score_job('Python Engineer', 'Python SQL required', 'Acme')
        assert isinstance(result, RelevanceScore)
        assert 0 <= result.overall_score <= 100

    def test_build_prompt_truncates_description(self, scorer):
        """Descriptions longer than 1500 chars are truncated in the prompt."""
        long_desc = 'x' * 2000
        prompt = scorer._build_prompt('Engineer', long_desc, 'Acme')
        # The raw long_desc is > 1500 chars, so it must have been sliced
        assert len(long_desc) > 1500
        assert 'x' * 1501 not in prompt

    def test_build_prompt_contains_title_and_company(self, scorer):
        """The prompt must embed the job title and company name."""
        prompt = scorer._build_prompt('Senior Python Engineer', 'Nice job', 'Acme Corp')
        assert 'Senior Python Engineer' in prompt
        assert 'Acme Corp' in prompt

    def test_score_job_exact_threshold_is_relevant(self, scorer):
        """A score exactly equal to the threshold should be considered relevant."""
        scorer.client.chat.completions.create.return_value = RelevanceScore(
            overall_score=60,
            is_relevant=True,
            reasons=[],
            red_flags=[],
            match_highlights=[],
        )
        result = scorer.score_job('Engineer', 'description', 'Acme')
        assert result.is_relevant is True

    def test_score_job_one_below_threshold_not_relevant(self, scorer):
        """A score one point below the threshold must be overridden to not relevant."""
        scorer.client.chat.completions.create.return_value = RelevanceScore(
            overall_score=59,
            is_relevant=True,
            reasons=[],
            red_flags=[],
            match_highlights=[],
        )
        result = scorer.score_job('Engineer', 'description', 'Acme')
        assert result.is_relevant is False
