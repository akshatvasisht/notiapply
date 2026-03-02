import { render, screen, fireEvent } from '@testing-library/react';
import JsonSchemaForm from './JsonSchemaForm';
import { describe, it, expect, vi } from 'vitest';

describe('JsonSchemaForm', () => {
    it('renders text, number, and boolean fields correctly', () => {
        const schema = {
            properties: {
                testString: { type: 'string', title: 'Test String', default: 'hello' },
                testNumber: { type: 'number', title: 'Test Number', default: 42 },
                testBool: { type: 'boolean', title: 'Test Bool', default: true }
            }
        };

        const onChange = vi.fn();
        render(<JsonSchemaForm schema={schema} value={{}} onChange={onChange} />);

        // Verify labels
        expect(screen.getByText('Test String')).toBeInTheDocument();
        expect(screen.getByText('Test Number')).toBeInTheDocument();
        expect(screen.getByText('Test Bool')).toBeInTheDocument();

        // Verify defaults populated in inputs
        const stringInput = screen.getByDisplayValue('hello');
        expect(stringInput).toBeInTheDocument();

        const numberInput = screen.getByDisplayValue('42');
        expect(numberInput).toBeInTheDocument();

        const boolInput = screen.getByRole('checkbox');
        expect((boolInput as HTMLInputElement).checked).toBe(true);
    });

    it('calls onChange when values are updated', () => {
        const schema = { properties: { url: { type: 'string', title: 'URL' } } };
        const onChange = vi.fn();

        render(<JsonSchemaForm schema={schema} value={{ url: 'test.com' }} onChange={onChange} />);

        const input = screen.getByDisplayValue('test.com');
        fireEvent.change(input, { target: { value: 'new.com' } });

        expect(onChange).toHaveBeenCalledWith({ url: 'new.com' });
    });

    it('renders enum as select dropdown', () => {
        const schema = {
            properties: {
                method: { enum: ['GET', 'POST', 'PUT'], title: 'HTTP Method' }
            }
        };
        render(<JsonSchemaForm schema={schema} value={{ method: 'POST' }} onChange={vi.fn()} />);

        const select = screen.getByDisplayValue('POST') as HTMLSelectElement;
        expect(select.tagName).toBe('SELECT');
        expect(screen.getByText('GET')).toBeInTheDocument();
    });
});
