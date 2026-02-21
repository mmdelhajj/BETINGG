'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Upload,
  Camera,
  FileText,
  User,
  MapPin,
  Calendar,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
type DocumentType = 'passport' | 'id_card' | 'drivers_license';

interface KYCState {
  status: VerificationStatus;
  currentStep: number;
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
    address: string;
    city: string;
    postalCode: string;
  };
  document: {
    type: DocumentType;
    frontFile: File | null;
    backFile: File | null;
    frontPreview: string;
    backPreview: string;
  };
  selfie: {
    file: File | null;
    preview: string;
  };
  rejectionReason?: string;
}

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const slideIn = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

// ---------------------------------------------------------------------------
// File Upload Component
// ---------------------------------------------------------------------------

function FileUploadArea({
  label,
  description,
  file,
  preview,
  onFileSelect,
  onRemove,
  accept = 'image/jpeg,image/png,image/webp',
}: {
  label: string;
  description: string;
  file: File | null;
  preview: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      onFileSelect(droppedFile);
    } else {
      toastError('Please upload an image file (JPG, PNG, or WebP)');
    }
  }, [onFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  if (preview) {
    return (
      <div className="relative">
        <p className="text-sm font-medium text-[#8B949E] mb-2">{label}</p>
        <div className="relative rounded-card overflow-hidden border border-[#30363D] bg-[#0D1117]">
          <img src={preview} alt={label} className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={onRemove}
              className="p-2 bg-[#EF4444] rounded-full text-white hover:bg-[#DC2626] transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-2 left-2">
            <Badge variant="success" size="xs">
              <Check className="w-3 h-3 mr-1" />
              Uploaded
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-[#8B949E] mb-2">{label}</p>
      <label
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center w-full h-48 rounded-card border-2 border-dashed cursor-pointer transition-all duration-200',
          isDragOver
            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
            : 'border-[#30363D] bg-[#0D1117] hover:border-[#8B5CF6]/30 hover:bg-[#161B22]'
        )}
      >
        <input type="file" className="hidden" accept={accept} onChange={handleFileInput} />
        <motion.div
          animate={isDragOver ? { scale: 1.1 } : { scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', isDragOver ? 'bg-[#8B5CF6]/20' : 'bg-[#1C2128]')}>
            <Upload className={cn('w-6 h-6', isDragOver ? 'text-[#8B5CF6]' : 'text-[#8B949E]')} />
          </div>
          <div className="text-center">
            <p className="text-sm text-[#E6EDF3]">
              <span className="text-[#8B5CF6]">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-[#8B949E] mt-1">{description}</p>
          </div>
        </motion.div>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Banner
// ---------------------------------------------------------------------------

function StatusBanner({ status, rejectionReason }: { status: VerificationStatus; rejectionReason?: string }) {
  const config = {
    unverified: {
      icon: ShieldAlert,
      title: 'Identity Not Verified',
      description: 'Complete KYC verification to unlock higher withdrawal limits and full platform features.',
      gradient: 'from-[#F59E0B]/10 to-[#0D1117]',
      borderColor: 'border-[#F59E0B]/30',
      iconColor: 'text-[#F59E0B]',
    },
    pending: {
      icon: Clock,
      title: 'Verification In Progress',
      description: 'Your documents are being reviewed. This usually takes 1-24 hours.',
      gradient: 'from-[#3B82F6]/10 to-[#0D1117]',
      borderColor: 'border-[#3B82F6]/30',
      iconColor: 'text-[#3B82F6]',
    },
    verified: {
      icon: ShieldCheck,
      title: 'Identity Verified',
      description: 'Your identity has been verified. You have access to all platform features.',
      gradient: 'from-[#10B981]/10 to-[#0D1117]',
      borderColor: 'border-[#10B981]/30',
      iconColor: 'text-[#10B981]',
    },
    rejected: {
      icon: ShieldAlert,
      title: 'Verification Rejected',
      description: rejectionReason || 'Your verification was rejected. Please resubmit your documents.',
      gradient: 'from-[#EF4444]/10 to-[#0D1117]',
      borderColor: 'border-[#EF4444]/30',
      iconColor: 'text-[#EF4444]',
    },
  };

  const c = config[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative overflow-hidden rounded-card border p-6', c.borderColor)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-r', c.gradient)} />
      <div className="relative z-10 flex items-start gap-4">
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center shrink-0', `${c.iconColor}/10`.replace('text-', 'bg-'))}>
          <c.icon className={cn('w-6 h-6', c.iconColor)} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#E6EDF3]">{c.title}</h2>
          <p className="text-sm text-[#8B949E] mt-1">{c.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { label: 'Personal Info', icon: User },
    { label: 'Identity Document', icon: FileText },
    { label: 'Selfie Verification', icon: Camera },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                i < currentStep
                  ? 'bg-[#10B981] border-[#10B981] text-white'
                  : i === currentStep
                  ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                  : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
              )}
            >
              {i < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
            </div>
            <span
              className={cn(
                'text-xs font-medium hidden sm:block',
                i <= currentStep ? 'text-[#E6EDF3]' : 'text-[#8B949E]'
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mx-3 rounded-full transition-colors duration-300',
                i < currentStep ? 'bg-[#10B981]' : 'bg-[#30363D]'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Personal Info
// ---------------------------------------------------------------------------

function PersonalInfoStep({
  info,
  onChange,
}: {
  info: KYCState['personalInfo'];
  onChange: (field: string, value: string) => void;
}) {
  const countries = [
    'United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia',
    'Japan', 'Singapore', 'Brazil', 'India', 'South Korea', 'Netherlands',
    'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Ireland', 'Portugal',
    'Spain', 'Italy', 'Austria', 'Belgium', 'Finland', 'New Zealand',
  ];

  return (
    <motion.div variants={slideIn} initial="initial" animate="animate" exit="exit" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First Name"
          placeholder="Enter your first name"
          value={info.firstName}
          onChange={(e) => onChange('firstName', e.target.value)}
          prefixIcon={<User className="w-4 h-4" />}
        />
        <Input
          label="Last Name"
          placeholder="Enter your last name"
          value={info.lastName}
          onChange={(e) => onChange('lastName', e.target.value)}
          prefixIcon={<User className="w-4 h-4" />}
        />
      </div>

      <Input
        label="Date of Birth"
        type="date"
        value={info.dateOfBirth}
        onChange={(e) => onChange('dateOfBirth', e.target.value)}
        prefixIcon={<Calendar className="w-4 h-4" />}
      />

      <div>
        <label className="block text-sm font-medium text-[#8B949E] mb-1.5">Country</label>
        <select
          value={info.country}
          onChange={(e) => onChange('country', e.target.value)}
          className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-[4px] px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]"
        >
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <Input
        label="Street Address"
        placeholder="Enter your street address"
        value={info.address}
        onChange={(e) => onChange('address', e.target.value)}
        prefixIcon={<MapPin className="w-4 h-4" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="City"
          placeholder="Enter city"
          value={info.city}
          onChange={(e) => onChange('city', e.target.value)}
        />
        <Input
          label="Postal Code"
          placeholder="Enter postal code"
          value={info.postalCode}
          onChange={(e) => onChange('postalCode', e.target.value)}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Document Upload
// ---------------------------------------------------------------------------

function DocumentStep({
  document,
  onTypeChange,
  onFrontSelect,
  onBackSelect,
  onRemoveFront,
  onRemoveBack,
}: {
  document: KYCState['document'];
  onTypeChange: (type: DocumentType) => void;
  onFrontSelect: (file: File) => void;
  onBackSelect: (file: File) => void;
  onRemoveFront: () => void;
  onRemoveBack: () => void;
}) {
  const docTypes: { value: DocumentType; label: string; icon: React.ReactNode }[] = [
    { value: 'passport', label: 'Passport', icon: <Globe className="w-5 h-5" /> },
    { value: 'id_card', label: 'National ID', icon: <FileText className="w-5 h-5" /> },
    { value: 'drivers_license', label: "Driver's License", icon: <FileText className="w-5 h-5" /> },
  ];

  return (
    <motion.div variants={slideIn} initial="initial" animate="animate" exit="exit" className="space-y-6">
      {/* Document Type */}
      <div>
        <label className="block text-sm font-medium text-[#8B949E] mb-3">Document Type</label>
        <div className="grid grid-cols-3 gap-3">
          {docTypes.map((dt) => (
            <button
              key={dt.value}
              onClick={() => onTypeChange(dt.value)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-card border-2 transition-all',
                document.type === dt.value
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 text-[#8B5CF6]'
                  : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#8B5CF6]/30'
              )}
            >
              {dt.icon}
              <span className="text-xs font-medium text-center">{dt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FileUploadArea
          label="Front Side"
          description="JPG, PNG or WebP, max 10MB"
          file={document.frontFile}
          preview={document.frontPreview}
          onFileSelect={onFrontSelect}
          onRemove={onRemoveFront}
        />
        {document.type !== 'passport' && (
          <FileUploadArea
            label="Back Side"
            description="JPG, PNG or WebP, max 10MB"
            file={document.backFile}
            preview={document.backPreview}
            onFileSelect={onBackSelect}
            onRemove={onRemoveBack}
          />
        )}
      </div>

      {/* Tips */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-4">
        <h4 className="text-sm font-medium text-[#E6EDF3] mb-2">Document Requirements</h4>
        <ul className="space-y-1.5 text-xs text-[#8B949E]">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            Document must be valid and not expired
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            All four corners of the document must be visible
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            Image must be clear and readable, no blur or glare
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
            Do not edit or crop the document image
          </li>
        </ul>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Selfie Verification
// ---------------------------------------------------------------------------

function SelfieStep({
  selfie,
  onSelect,
  onRemove,
}: {
  selfie: KYCState['selfie'];
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <motion.div variants={slideIn} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div className="text-center mb-4">
        <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-3">
          <Camera className="w-8 h-8 text-[#8B5CF6]" />
        </div>
        <h3 className="text-lg font-bold text-[#E6EDF3]">Take a Selfie</h3>
        <p className="text-sm text-[#8B949E] mt-1">
          Take a clear photo of yourself holding your identity document next to your face.
        </p>
      </div>

      <FileUploadArea
        label="Selfie with Document"
        description="JPG, PNG or WebP, max 10MB"
        file={selfie.file}
        preview={selfie.preview}
        onFileSelect={onSelect}
        onRemove={onRemove}
      />

      {/* Guidelines */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-4">
        <h4 className="text-sm font-medium text-[#E6EDF3] mb-3">Selfie Guidelines</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <span className="text-xs text-[#8B949E]">Face must be clearly visible</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <span className="text-xs text-[#8B949E]">Hold document next to face</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <span className="text-xs text-[#8B949E]">Good lighting, no shadows</span>
          </div>
          <div className="flex items-start gap-2">
            <X className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <span className="text-xs text-[#8B949E]">No sunglasses, hats, or masks</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// KYC Page
// ---------------------------------------------------------------------------

export default function KYCPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycState, setKycState] = useState<KYCState>({
    status: 'unverified',
    currentStep: 0,
    personalInfo: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      country: '',
      address: '',
      city: '',
      postalCode: '',
    },
    document: {
      type: 'passport',
      frontFile: null,
      backFile: null,
      frontPreview: '',
      backPreview: '',
    },
    selfie: {
      file: null,
      preview: '',
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handlePersonalInfoChange = (field: string, value: string) => {
    setKycState((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value },
    }));
  };

  const handleDocTypeChange = (type: DocumentType) => {
    setKycState((prev) => ({
      ...prev,
      document: { ...prev.document, type },
    }));
  };

  const handleFileSelect = (section: 'frontFile' | 'backFile' | 'selfie', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (section === 'selfie') {
        setKycState((prev) => ({
          ...prev,
          selfie: { file, preview },
        }));
      } else {
        const previewKey = section === 'frontFile' ? 'frontPreview' : 'backPreview';
        setKycState((prev) => ({
          ...prev,
          document: { ...prev.document, [section]: file, [previewKey]: preview },
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (section: 'frontFile' | 'backFile' | 'selfie') => {
    if (section === 'selfie') {
      setKycState((prev) => ({
        ...prev,
        selfie: { file: null, preview: '' },
      }));
    } else {
      const previewKey = section === 'frontFile' ? 'frontPreview' : 'backPreview';
      setKycState((prev) => ({
        ...prev,
        document: { ...prev.document, [section]: null, [previewKey]: '' },
      }));
    }
  };

  const canProceed = () => {
    const { currentStep, personalInfo, document: doc, selfie } = kycState;
    switch (currentStep) {
      case 0:
        return personalInfo.firstName && personalInfo.lastName && personalInfo.dateOfBirth && personalInfo.country && personalInfo.address && personalInfo.city && personalInfo.postalCode;
      case 1:
        return doc.frontPreview && (doc.type === 'passport' || doc.backPreview);
      case 2:
        return selfie.preview;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (kycState.currentStep < 2) {
      setKycState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const handlePrev = () => {
    if (kycState.currentStep > 0) {
      setKycState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setKycState((prev) => ({ ...prev, status: 'pending' }));
    setIsSubmitting(false);
    toastSuccess('Verification documents submitted successfully! We will review them shortly.');
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </Link>
      </motion.div>

      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-[#E6EDF3]">Identity Verification</h1>
        <p className="text-sm text-[#8B949E] mt-1">Complete KYC to unlock full platform features</p>
      </motion.div>

      {/* Status Banner */}
      <div className="mb-6">
        <StatusBanner status={kycState.status} rejectionReason={kycState.rejectionReason} />
      </div>

      {/* Verification Form (only show for unverified or rejected) */}
      {(kycState.status === 'unverified' || kycState.status === 'rejected') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Step Indicator */}
          <StepIndicator currentStep={kycState.currentStep} totalSteps={3} />

          {/* Step Content */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6 mb-6">
            <AnimatePresence mode="wait">
              {kycState.currentStep === 0 && (
                <PersonalInfoStep
                  key="step-0"
                  info={kycState.personalInfo}
                  onChange={handlePersonalInfoChange}
                />
              )}
              {kycState.currentStep === 1 && (
                <DocumentStep
                  key="step-1"
                  document={kycState.document}
                  onTypeChange={handleDocTypeChange}
                  onFrontSelect={(f) => handleFileSelect('frontFile', f)}
                  onBackSelect={(f) => handleFileSelect('backFile', f)}
                  onRemoveFront={() => handleRemoveFile('frontFile')}
                  onRemoveBack={() => handleRemoveFile('backFile')}
                />
              )}
              {kycState.currentStep === 2 && (
                <SelfieStep
                  key="step-2"
                  selfie={kycState.selfie}
                  onSelect={(f) => handleFileSelect('selfie', f)}
                  onRemove={() => handleRemoveFile('selfie')}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={handlePrev}
              disabled={kycState.currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {kycState.currentStep < 2 ? (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed()}
                isLoading={isSubmitting}
              >
                <Shield className="w-4 h-4" />
                Submit Verification
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Verification Limits Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
          <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4">Verification Levels</h3>
          <div className="space-y-4">
            {[
              { level: 'Basic', limit: '$2,000/day', requirements: 'Email verified', status: 'active' },
              { level: 'Intermediate', limit: '$10,000/day', requirements: 'ID verification', status: kycState.status === 'verified' ? 'active' : 'locked' },
              { level: 'Advanced', limit: 'Unlimited', requirements: 'Proof of address', status: 'locked' },
            ].map((lvl) => (
              <div key={lvl.level} className="flex items-center justify-between p-3 bg-[#0D1117] rounded-card">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', lvl.status === 'active' ? 'bg-[#10B981]/10' : 'bg-[#30363D]/50')}>
                    {lvl.status === 'active' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    ) : (
                      <Shield className="w-4 h-4 text-[#8B949E]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E6EDF3]">{lvl.level}</p>
                    <p className="text-xs text-[#8B949E]">{lvl.requirements}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-[#E6EDF3]">{lvl.limit}</p>
                  <p className="text-[10px] text-[#8B949E]">withdrawal limit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
