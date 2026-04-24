'use client';

import { forwardRef } from 'react';

const SharedTextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function SharedTextArea(props, ref) {
  const { style, ...rest } = props;
  return (
    <textarea
      ref={ref}
      {...rest}
      style={{
        width: '100%',
        minHeight: 100,
        padding: '8px 12px',
        borderRadius: 6,
        border: '1px solid var(--color-outline-variant)',
        background: 'var(--color-surface)',
        color: 'var(--color-on-surface)',
        fontSize: 12,
        fontFamily: 'inherit',
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
});

export default SharedTextArea;
