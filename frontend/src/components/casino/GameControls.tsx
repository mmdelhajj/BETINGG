'use client';

import React, { useState } from 'react';
import { Home, Info, Volume2, VolumeX, History, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Shared Cloudbet-style game control components
// ---------------------------------------------------------------------------

/** Lime CTA button (Place Bet / Pick / Roll / Deal etc) */
export function LimeCTA({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full py-3.5 rounded-xl font-bold text-base text-black transition-all duration-200',
        'bg-[#C8FF00] hover:bg-[#D4FF33] active:bg-[#B8EE00]',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#C8FF00]',
        'shadow-[0_0_20px_rgba(200,255,0,0.15)]',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Secondary action button (Cash Out, Demo Play, etc) */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
  variant = 'olive',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'olive' | 'muted' | 'danger';
}) {
  const variants = {
    olive: 'bg-[#2A2A1A] text-[#C8FF00] hover:bg-[#333320] border border-[#C8FF00]/20',
    muted: 'bg-[#1C2128] text-[#8B949E] hover:bg-[#21262D] border border-[#30363D]',
    danger: 'bg-[#2A1A1A] text-[#EF4444] hover:bg-[#332020] border border-[#EF4444]/20',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full py-3 rounded-xl font-bold text-base transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

/** Bet Amount field with 1/2 and 2X buttons */
export function BetAmountField({
  value,
  onChange,
  currency = 'USD',
  disabled,
  label = 'Bet Amount',
}: {
  value: string;
  onChange: (val: string) => void;
  currency?: string;
  disabled?: boolean;
  label?: string;
}) {
  const handleHalf = () => {
    const num = parseFloat(value) || 0;
    onChange(Math.max(0.01, num / 2).toFixed(2));
  };
  const handleDouble = () => {
    const num = parseFloat(value) || 0;
    onChange((num * 2).toFixed(2));
  };

  return (
    <div>
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      <div className="flex items-center bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden">
        <span className="px-3 text-[#10B981] text-sm font-bold">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 bg-transparent text-white text-sm py-2.5 outline-none font-mono min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          step="0.01"
          min="0.01"
        />
        <button
          onClick={handleHalf}
          disabled={disabled}
          className="px-3 py-2.5 text-xs font-bold text-[#8B949E] hover:text-white border-l border-[#30363D] transition-colors disabled:opacity-40"
        >
          1/2
        </button>
        <button
          onClick={handleDouble}
          disabled={disabled}
          className="px-3 py-2.5 text-xs font-bold text-[#8B949E] hover:text-white border-l border-[#30363D] transition-colors disabled:opacity-40"
        >
          2X
        </button>
      </div>
    </div>
  );
}

/** Balance display field */
export function BalanceField({
  value,
  label = 'Balance',
  currency = 'USD',
}: {
  value: number | string;
  label?: string;
  currency?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      <div className="flex items-center bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2.5">
        <span className="flex-1 text-white text-sm font-mono">
          {typeof value === 'number' ? value.toFixed(4) : value}
        </span>
        <span className="text-[#10B981] text-sm font-bold">$</span>
      </div>
    </div>
  );
}

/** Profit On Win display */
export function ProfitField({
  value,
  label = 'Profit On Win',
}: {
  value: number | string;
  label?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      <div className="flex items-center bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2.5">
        <span className="flex-1 text-white text-sm font-mono">
          {typeof value === 'number' ? value.toFixed(4) : value}
        </span>
        <span className="text-[#10B981] text-sm font-bold">$</span>
      </div>
    </div>
  );
}

/** Manual / Auto toggle */
export function ManualAutoToggle({
  mode,
  onModeChange,
}: {
  mode: 'manual' | 'auto';
  onModeChange: (mode: 'manual' | 'auto') => void;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-[#30363D]">
      <button
        onClick={() => onModeChange('manual')}
        className={cn(
          'flex-1 py-2.5 text-sm font-bold transition-all duration-200',
          mode === 'manual'
            ? 'bg-[#8B5CF6] text-white'
            : 'bg-[#161B22] text-[#8B949E] hover:text-white'
        )}
      >
        Manual
      </button>
      <button
        onClick={() => onModeChange('auto')}
        className={cn(
          'flex-1 py-2.5 text-sm font-bold transition-all duration-200',
          mode === 'auto'
            ? 'bg-[#8B5CF6] text-white'
            : 'bg-[#161B22] text-[#8B949E] hover:text-white'
        )}
      >
        Auto
      </button>
    </div>
  );
}

/** Game bottom bar with home, info, sound, history, settings, balance, provably fair badge */
export function GameBottomBar({
  balance,
  onHistoryClick,
  onInfoClick,
  showHistory = true,
}: {
  balance?: number;
  onHistoryClick?: () => void;
  onInfoClick?: () => void;
  showHistory?: boolean;
}) {
  const [soundOn, setSoundOn] = useState(true);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#0D1117] border-t border-[#30363D]">
      {/* Left icons */}
      <div className="flex items-center gap-3">
        <button className="text-[#8B949E] hover:text-white transition-colors">
          <Home className="w-4 h-4" />
        </button>
        <button
          onClick={onInfoClick}
          className="text-[#8B949E] hover:text-white transition-colors"
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className="text-[#8B949E] hover:text-white transition-colors"
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Center: balance */}
      {balance !== undefined && (
        <div className="flex items-center gap-1.5 bg-[#161B22] px-3 py-1 rounded-full">
          <span className="text-xs font-mono text-white">{balance.toFixed(4)}</span>
          <span className="text-[#10B981] text-xs font-bold">$</span>
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-2">
        {showHistory && (
          <button
            onClick={onHistoryClick}
            className="text-[#C8FF00] text-xs font-bold hover:text-[#D4FF33] transition-colors"
          >
            History
          </button>
        )}
        <div className="flex items-center gap-1 bg-[#8B5CF6]/20 px-2 py-1 rounded-full">
          <Shield className="w-3 h-3 text-[#8B5CF6]" />
          <span className="text-[10px] font-bold text-[#8B5CF6]">Provably Fair</span>
        </div>
      </div>
    </div>
  );
}

/** Stat field - used for Multiplier, Win Chance, etc */
export function StatField({
  label,
  value,
  icon,
  onChange,
  editable = false,
  suffix,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  onChange?: (val: string) => void;
  editable?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      <div className="flex items-center bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2.5">
        {editable ? (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="flex-1 bg-transparent text-white text-sm outline-none font-mono min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            step="0.01"
          />
        ) : (
          <span className="flex-1 text-white text-sm font-mono">{value}{suffix}</span>
        )}
        {icon && <span className="ml-2 text-[#8B949E]">{icon}</span>}
      </div>
    </div>
  );
}

/** Number increment/decrement field (for mine count, etc) */
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 24,
  disabled,
  presets,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  presets?: number[];
}) {
  return (
    <div>
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      {presets ? (
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              disabled={disabled}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200',
                value === p
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#161B22] text-[#8B949E] border border-[#30363D] hover:border-[#8B5CF6]/40'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={disabled || value <= min}
            className="px-4 py-2.5 text-[#8B949E] hover:text-white border-r border-[#30363D] transition-colors disabled:opacity-40"
          >
            −
          </button>
          <span className="flex-1 text-center text-white text-sm font-mono">{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={disabled || value >= max}
            className="px-4 py-2.5 text-[#8B949E] hover:text-white border-l border-[#30363D] transition-colors disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

/** Dropdown select (for Roll Mode, etc) */
export function GameSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-[#8B949E] mb-1 block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2.5 text-white text-sm font-mono appearance-none outline-none focus:border-[#8B5CF6]/40 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B949E]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
