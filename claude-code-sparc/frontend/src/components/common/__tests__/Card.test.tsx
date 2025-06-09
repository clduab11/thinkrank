import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renders with children content', () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>
    );
    
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders with header', () => {
    render(
      <Card header="Card Title">
        <p>Card body</p>
      </Card>
    );
    
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('renders with footer', () => {
    render(
      <Card footer={<button>Save</button>}>
        <p>Card content</p>
      </Card>
    );
    
    expect(screen.getByText('Card content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('can be clickable', () => {
    const handleClick = vi.fn();
    render(
      <Card onClick={handleClick}>
        <p>Clickable card</p>
      </Card>
    );
    
    const card = screen.getByText('Clickable card').closest('[role="button"]');
    expect(card).toHaveClass('cursor-pointer');
    
    fireEvent.click(card!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies hover state when clickable', () => {
    render(
      <Card onClick={vi.fn()}>
        <p>Hoverable card</p>
      </Card>
    );
    
    const card = screen.getByText('Hoverable card').closest('[role="button"]');
    expect(card).toHaveClass('hover:shadow-lg');
  });

  it('applies variant styles', () => {
    const { rerender } = render(
      <Card variant="default">
        <p>Default card</p>
      </Card>
    );
    
    let card = screen.getByText('Default card').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('bg-white');
    
    rerender(
      <Card variant="outlined">
        <p>Outlined card</p>
      </Card>
    );
    
    card = screen.getByText('Outlined card').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('border');
    
    rerender(
      <Card variant="filled">
        <p>Filled card</p>
      </Card>
    );
    
    card = screen.getByText('Filled card').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('bg-gray-50');
  });

  it('applies padding options', () => {
    const { rerender } = render(
      <Card padding="none">
        <p>No padding</p>
      </Card>
    );
    
    let card = screen.getByText('No padding').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('p-0');
    
    rerender(
      <Card padding="small">
        <p>Small padding</p>
      </Card>
    );
    
    card = screen.getByText('Small padding').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('p-3');
    
    rerender(
      <Card padding="medium">
        <p>Medium padding</p>
      </Card>
    );
    
    card = screen.getByText('Medium padding').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('p-4');
    
    rerender(
      <Card padding="large">
        <p>Large padding</p>
      </Card>
    );
    
    card = screen.getByText('Large padding').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('p-6');
  });

  it('applies custom className', () => {
    render(
      <Card className="custom-card">
        <p>Custom styled card</p>
      </Card>
    );
    
    const card = screen.getByText('Custom styled card').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('custom-card');
  });

  it('renders with complex header content', () => {
    render(
      <Card
        header={
          <div className="flex justify-between">
            <h3>Title</h3>
            <button>Action</button>
          </div>
        }
      >
        <p>Card body</p>
      </Card>
    );
    
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('can be disabled', () => {
    const handleClick = vi.fn();
    render(
      <Card onClick={handleClick} disabled>
        <p>Disabled card</p>
      </Card>
    );
    
    const card = screen.getByText('Disabled card').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('opacity-50 cursor-not-allowed');
    
    fireEvent.click(card!);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders as different HTML element with as prop', () => {
    render(
      <Card as="article">
        <p>Article card</p>
      </Card>
    );
    
    const article = screen.getByText('Article card').closest('article');
    expect(article?.tagName).toBe('ARTICLE');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(
      <Card ref={ref}>
        <p>Card with ref</p>
      </Card>
    );
    
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
  });

  it('handles keyboard navigation when clickable', () => {
    const handleClick = vi.fn();
    render(
      <Card onClick={handleClick} tabIndex={0}>
        <p>Keyboard navigable card</p>
      </Card>
    );
    
    const card = screen.getByText('Keyboard navigable card').closest('[role="button"]');
    
    fireEvent.keyDown(card!, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    fireEvent.keyDown(card!, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('applies elevation shadow', () => {
    const { rerender } = render(
      <Card elevation={0}>
        <p>No shadow</p>
      </Card>
    );
    
    let card = screen.getByText('No shadow').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('shadow-none');
    
    rerender(
      <Card elevation={1}>
        <p>Small shadow</p>
      </Card>
    );
    
    card = screen.getByText('Small shadow').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('shadow-sm');
    
    rerender(
      <Card elevation={2}>
        <p>Medium shadow</p>
      </Card>
    );
    
    card = screen.getByText('Medium shadow').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('shadow-md');
    
    rerender(
      <Card elevation={3}>
        <p>Large shadow</p>
      </Card>
    );
    
    card = screen.getByText('Large shadow').closest('div[class*="rounded-lg"]');
    expect(card).toHaveClass('shadow-lg');
  });
});