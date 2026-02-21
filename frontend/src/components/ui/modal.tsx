'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Modal Root
// ---------------------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Modal({ open, onOpenChange, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>{open && children}</AnimatePresence>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Modal Content
// ---------------------------------------------------------------------------

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

function ModalContent({
  children,
  className,
  size = 'md',
  showClose = true,
}: ModalContentProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw]',
  };

  return (
    <Dialog.Portal forceMount>
      <Dialog.Overlay asChild>
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      </Dialog.Overlay>
      <Dialog.Content asChild>
        <motion.div
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'bg-background-card border border-border rounded-card shadow-xl',
            'p-6 focus:outline-none',
            sizeClasses[size],
            className,
          )}
          initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
          animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
          exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {showClose && (
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-button p-1 text-text-muted hover:text-text hover:bg-background-elevated transition-colors duration-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          )}
          <Dialog.Description className="sr-only">
            Dialog content
          </Dialog.Description>
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// Modal Header
// ---------------------------------------------------------------------------

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

function ModalHeader({ children, className }: ModalHeaderProps) {
  return <div className={cn('mb-4 pr-8', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Modal Title
// ---------------------------------------------------------------------------

interface ModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

function ModalTitle({ children, className }: ModalTitleProps) {
  return (
    <Dialog.Title className={cn('text-lg font-semibold text-text', className)}>
      {children}
    </Dialog.Title>
  );
}

// ---------------------------------------------------------------------------
// Modal Description
// ---------------------------------------------------------------------------

interface ModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

function ModalDescription({ children, className }: ModalDescriptionProps) {
  return (
    <Dialog.Description
      className={cn('text-sm text-text-secondary mt-1', className)}
    >
      {children}
    </Dialog.Description>
  );
}

// ---------------------------------------------------------------------------
// Modal Body
// ---------------------------------------------------------------------------

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={cn('', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Modal Footer
// ---------------------------------------------------------------------------

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'mt-6 flex items-center justify-end gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
};
