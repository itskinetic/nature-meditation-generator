import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ServerCrash,
  WifiOff,
  Sparkles,
  Clock,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { ApiErrorInfo } from '../types';
import { onApiError, emitApiError } from '../api/client';

export const ApiErrorPrompt: React.FC = () => {
  const [errors, setErrors] = useState<ApiErrorInfo[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Subscribe to API error events from client.ts
  useEffect(() => {
    const unsubscribe = onApiError((newError) => {
      setErrors((prev) => {
        // Deduplicate identical errors arriving within 2 seconds
        const isDuplicate = prev.some(
          (e) =>
            e.title === newError.title &&
            e.message === newError.message &&
            Math.abs(Date.now() - parseInt(e.id.split('_')[1] || '0', 10)) < 2500
        );
        if (isDuplicate) return prev;
        // Keep at most 4 recent errors in stack
        return [newError, ...prev].slice(0, 4);
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-dismiss the oldest error every 10 seconds when not hovered
  useEffect(() => {
    if (errors.length === 0 || isHovered) return;

    const timer = setTimeout(() => {
      setErrors((prev) => prev.slice(0, -1));
    }, 10000);

    return () => clearTimeout(timer);
  }, [errors, isHovered]);

  const handleDismiss = (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDismissAll = () => {
    setErrors([]);
    setExpandedIds(new Set());
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = (err: ApiErrorInfo) => {
    const diagnosticReport = [
      `[API Error Report]`,
      `Title: ${err.title}`,
      `Category: ${err.category}`,
      `Endpoint: ${err.endpoint || 'N/A'}`,
      `Status: ${err.status ? `${err.status} ${err.statusText || ''}` : 'Network / Client'}`,
      `Time: ${err.timestamp}`,
      `Message: ${err.message}`,
      err.detail ? `Details: ${err.detail}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(diagnosticReport).then(() => {
      setCopiedId(err.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (errors.length === 0) return null;

  return (
    <div
      className="fixed top-5 right-5 z-[9999] max-w-md w-full px-3 pointer-events-none flex flex-col gap-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="API Error Notifications"
    >
      {errors.length > 1 && (
        <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-xl bg-stone-900/90 text-stone-200 text-xs shadow-lg backdrop-blur-md border border-stone-800 self-end">
          <span className="font-semibold text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            {errors.length} API issues reported
          </span>
          <button
            type="button"
            onClick={handleDismissAll}
            className="ml-3 text-[11px] text-stone-400 hover:text-white underline cursor-pointer"
          >
            Dismiss All
          </button>
        </div>
      )}

      {errors.map((err) => {
        const isExpanded = expandedIds.has(err.id);
        const isCopied = copiedId === err.id;

        // Styling based on error category
        let badgeColor = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
        let borderColor = 'border-rose-400/50 dark:border-rose-500/40 ring-1 ring-rose-500/20';
        let IconComponent = ServerCrash;
        let badgeLabel = 'Server Issue';

        if (err.category === 'rate_limit') {
          badgeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
          borderColor = 'border-amber-400/50 dark:border-amber-500/40 ring-1 ring-amber-500/20';
          IconComponent = Clock;
          badgeLabel = 'Rate Limit (429)';
        } else if (err.category === 'ai') {
          badgeColor = 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
          borderColor = 'border-purple-400/50 dark:border-purple-500/40 ring-1 ring-purple-500/20';
          IconComponent = Sparkles;
          badgeLabel = 'Gemini AI Error';
        } else if (err.category === 'provider') {
          badgeColor = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
          borderColor = 'border-sky-400/50 dark:border-sky-500/40 ring-1 ring-sky-500/20';
          IconComponent = AlertTriangle;
          badgeLabel = 'Stock Provider';
        } else if (err.category === 'network') {
          badgeColor = 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
          borderColor = 'border-orange-400/50 dark:border-orange-500/40 ring-1 ring-orange-500/20';
          IconComponent = WifiOff;
          badgeLabel = 'Connection Lost';
        } else if (err.status === 502 || err.status === 504) {
          badgeColor = 'bg-rose-500/20 text-rose-500 dark:text-rose-400 border-rose-500/40';
          borderColor = 'border-rose-500/60 dark:border-rose-500/60 ring-2 ring-rose-500/30';
          IconComponent = ServerCrash;
          badgeLabel = `Gateway ${err.status}`;
        }

        return (
          <div
            key={err.id}
            className={`pointer-events-auto w-full rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md shadow-2xl p-4 transition-all duration-200 border ${borderColor} text-stone-900 dark:text-stone-100 relative overflow-hidden`}
          >
            {/* Header: Icon + Category Badge + Dismiss */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-xl shrink-0 ${badgeColor}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
                      {badgeLabel}
                    </span>
                    {err.status && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        HTTP {err.status}
                      </span>
                    )}
                    <span className="text-[10px] text-stone-400 ml-auto">
                      {err.timestamp}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-white mt-1 leading-snug">
                    {err.title}
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDismiss(err.id)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2 leading-relaxed break-words">
              {err.message}
            </p>

            {/* Expandable Technical Details */}
            {isExpanded && (
              <div className="mt-3 pt-2.5 border-t border-stone-200/80 dark:border-stone-800/80 space-y-2 text-[11px] font-mono">
                {err.endpoint && (
                  <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 bg-stone-100/80 dark:bg-stone-950/60 px-2 py-1 rounded-md">
                    <span className="font-semibold">Endpoint:</span>
                    <span className="truncate max-w-[240px] text-stone-700 dark:text-stone-300">{err.endpoint}</span>
                  </div>
                )}
                {err.detail && (
                  <div className="p-2 rounded-lg bg-stone-100/90 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 max-h-32 overflow-y-auto text-stone-700 dark:text-stone-300 whitespace-pre-wrap break-all leading-tight">
                    {err.detail}
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800/60 text-xs">
              <button
                type="button"
                onClick={() => toggleExpand(err.id)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Terminal className="w-3 h-3" />
                <span>{isExpanded ? 'Hide Details' : 'Technical Details'}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(err)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                  title="Copy error details to clipboard"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(err.id)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Auto-dismiss countdown bar */}
            {!isHovered && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-200 dark:bg-stone-800">
                <div className="h-full bg-rose-500/60 dark:bg-rose-400/60 animate-[shrink_10s_linear_forwards]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Utility function to trigger a test API error for verification
export function triggerTestApiError(category: ApiErrorInfo['category'] = 'rate_limit') {
  const samples: Record<string, Omit<ApiErrorInfo, 'id' | 'timestamp'>> = {
    rate_limit: {
      title: 'API Rate Limit Exceeded (HTTP 429)',
      message: 'Too many requests were sent to the Pexels API in a short window. Please wait 45 seconds before searching again.',
      category: 'rate_limit',
      status: 429,
      statusText: 'Too Many Requests',
      endpoint: '/api/search',
      detail: 'Rate limit reached: 200 requests per hour exceeded on provider API key.',
    },
    ai: {
      title: 'Gemini AI API Error',
      message: 'AI Director could not process the script prompt because the API quota has been reached.',
      category: 'ai',
      status: 500,
      statusText: 'Internal Server Error',
      endpoint: '/api/analyze',
      detail: 'google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded for quota metric "GenerateContent requests".',
    },
    server: {
      title: 'Server Gateway Error (HTTP 502)',
      message: 'The backend container is temporarily restarting on your VPS. Please check Easypanel resources.',
      category: 'server',
      status: 502,
      statusText: 'Bad Gateway',
      endpoint: '/api/generate',
      detail: '502 Bad Gateway: Container connection reset by peer. Server memory may have exceeded container limit.',
    },
    network: {
      title: 'Network Connection Lost',
      message: 'Unable to connect to the backend server. Verify your internet connection or check if the VPS server is online.',
      category: 'network',
      endpoint: '/api/health',
      detail: 'TypeError: Failed to fetch (net::ERR_CONNECTION_REFUSED)',
    },
  };

  const sample = samples[category] || samples.rate_limit;
  emitApiError(sample);
}
