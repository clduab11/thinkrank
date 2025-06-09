import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled Button
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600');
    
    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-secondary-600');
    
    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-error');
  });

  it('applies size styles', () => {
    const { rerender } = render(<Button size="small">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3 py-1.5 text-sm');
    
    rerender(<Button size="medium">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-4 py-2 text-base');
    
    rerender(<Button size="large">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6 py-3 text-lg');
  });

  it('renders with full width', () => {
    render(<Button fullWidth>Full Width</Button>);
    
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-75');
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders as a different element with as prop', () => {
    render(
      <Button as="a" href="/test">
        Link Button
      </Button>
    );
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveTextContent('Link Button');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Button with ref</Button>);
    
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('handles keyboard events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Keyboard</Button>);
    
    const button = screen.getByRole('button');
    
    // Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    // Space key
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});