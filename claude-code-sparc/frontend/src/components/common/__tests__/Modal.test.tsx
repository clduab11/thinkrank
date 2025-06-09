import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders when open', () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders with title', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Modal Title">
        <p>Modal body</p>
      </Modal>
    );
    
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test Modal">
        <p>Content</p>
      </Modal>
    );
    
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose}>
        <p>Content</p>
      </Modal>
    );
    
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose}>
        <p>Content</p>
      </Modal>
    );
    
    fireEvent.click(screen.getByText('Content'));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose}>
        <p>Content</p>
      </Modal>
    );
    
    await userEvent.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies size styles', () => {
    const { rerender } = render(
      <Modal isOpen onClose={vi.fn()} size="small">
        <p>Small modal</p>
      </Modal>
    );
    
    let modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-sm');
    
    rerender(
      <Modal isOpen onClose={vi.fn()} size="medium">
        <p>Medium modal</p>
      </Modal>
    );
    
    modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-lg');
    
    rerender(
      <Modal isOpen onClose={vi.fn()} size="large">
        <p>Large modal</p>
      </Modal>
    );
    
    modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-2xl');
    
    rerender(
      <Modal isOpen onClose={vi.fn()} size="full">
        <p>Full modal</p>
      </Modal>
    );
    
    modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-full');
  });

  it('can be set to not close on overlay click', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} closeOnOverlayClick={false}>
        <p>Content</p>
      </Modal>
    );
    
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('can be set to not close on Escape key', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} closeOnEscape={false}>
        <p>Content</p>
      </Modal>
    );
    
    await userEvent.keyboard('{Escape}');
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('renders footer content', () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        footer={
          <div>
            <button>Cancel</button>
            <button>Save</button>
          </div>
        }
      >
        <p>Modal body</p>
      </Modal>
    );
    
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Modal isOpen onClose={vi.fn()} className="custom-modal">
        <p>Content</p>
      </Modal>
    );
    
    const modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('custom-modal');
  });

  it('traps focus within modal', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Focus Trap Test">
        <input type="text" placeholder="First input" />
        <button>Action</button>
        <input type="text" placeholder="Last input" />
      </Modal>
    );
    
    const firstInput = screen.getByPlaceholderText('First input');
    const lastInput = screen.getByPlaceholderText('Last input');
    const closeButton = screen.getByRole('button', { name: /close/i });
    
    // Wait for focus to be set
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });
    
    // Tab through elements
    await userEvent.tab();
    expect(document.activeElement).toBe(firstInput);
    
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Action' }));
    
    await userEvent.tab();
    expect(document.activeElement).toBe(lastInput);
    
    // Tab from last element should go back to close button
    await userEvent.tab();
    expect(document.activeElement).toBe(closeButton);
  });

  it('restores focus on close', async () => {
    const button = document.createElement('button');
    button.textContent = 'Open Modal';
    document.body.appendChild(button);
    button.focus();
    
    const { rerender } = render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    
    expect(document.activeElement).toBe(button);
    
    rerender(
      <Modal isOpen onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    
    // Wait for focus to move to modal
    await waitFor(() => {
      expect(document.activeElement).not.toBe(button);
    });
    
    rerender(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    
    // Focus returns to button
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
    
    document.body.removeChild(button);
  });

  it('prevents body scroll when open', () => {
    const { rerender } = render(
      <Modal isOpen onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('');
  });

  it('renders with custom overlay className', () => {
    render(
      <Modal isOpen onClose={vi.fn()} overlayClassName="custom-overlay">
        <p>Content</p>
      </Modal>
    );
    
    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay).toHaveClass('custom-overlay');
  });

  it('supports portal rendering', () => {
    const container = document.createElement('div');
    container.id = 'modal-root';
    document.body.appendChild(container);
    
    render(
      <Modal isOpen onClose={vi.fn()} portalTarget="#modal-root">
        <p>Portal content</p>
      </Modal>
    );
    
    expect(container.querySelector('p')).toHaveTextContent('Portal content');
    
    document.body.removeChild(container);
  });
});