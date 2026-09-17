// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import LiveRuntimeLab from './LiveRuntimeLab';

afterEach(cleanup);

describe('real runtime host and reference adapter', () => {
  it('keeps the actual input node and unfinished draft through help, then accepts a fresh item', async () => {
    render(<StrictMode><LiveRuntimeLab /></StrictMode>);
    const input = screen.getByLabelText('Your answer') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByText('Check answer'));
    fireEvent.click(screen.getByText('A different subtraction example'));
    expect(screen.getByRole('complementary', { name: 'Worked example' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(input.isConnected).toBe(true);
    expect(input.closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Seven counters');
    fireEvent.click(screen.getByText('Return to the same unfinished task'));
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input.value).toBe('2');
    expect(screen.getByText('Checked result: incorrect')).toBeTruthy();
    expect(screen.queryByText('A different subtraction example')).toBeNull();
    fireEvent.click(screen.getByText('Try the same task again'));
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Check answer'));
    fireEvent.click(screen.getByText('Try a fresh transfer item'));
    expect(screen.getByText('Find 9 minus 2.')).toBeTruthy();
    expect(input.value).toBe('');
    expect(screen.getByText('Checked result: unknown')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).not.toContain('awaiting paint'));
  });

  it('withholds completion while closing speech is outstanding and emits just one completion', () => {
    render(<LiveRuntimeLab />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Check answer'));
    fireEvent.click(screen.getByText('Try a fresh transfer item'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '7' } });
    fireEvent.click(screen.getByText('Check answer'));
    fireEvent.click(screen.getByText('Hold teaching turn'));
    fireEvent.click(screen.getByText('Report terminal completion'));
    expect(screen.getByRole('status').textContent).toContain('closing');
    expect(screen.getByRole('status').textContent).toContain('completion events: 0');
    fireEvent.click(screen.getByText('Settle teaching turn'));
    fireEvent.click(screen.getByText('Report terminal completion'));
    expect(screen.getByRole('status').textContent).toContain('completed');
    expect(screen.getByRole('status').textContent).toContain('completion events: 1');
  });
});
