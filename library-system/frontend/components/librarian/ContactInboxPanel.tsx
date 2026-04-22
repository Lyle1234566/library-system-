'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Loader2,
  Search,
  Send,
} from 'lucide-react';
import {
  contactMessagesApi,
  type ContactMessageRecord,
  type ContactMessageStatus,
} from '@/lib/api';

type SectionState = 'idle' | 'loading' | 'error';

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const diffMs = parsed.getTime() - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 60) return 'Just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ] as const;
  for (const [unit, seconds] of units) {
    if (absSeconds >= seconds) {
      return formatter.format(Math.round(diffMs / 1000 / seconds), unit);
    }
  }
  return 'Just now';
};

const getStatusTone = (status: ContactMessageStatus) => {
  if (status === 'NEW') return 'border-sky-300/35 bg-sky-500/15 text-sky-100';
  if (status === 'IN_PROGRESS') return 'border-amber-300/35 bg-amber-500/15 text-amber-100';
  return 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100';
};

const getStatusLabel = (status: ContactMessageStatus) =>
  status === 'IN_PROGRESS' ? 'In Progress' : status === 'RESOLVED' ? 'Resolved' : 'New';

const getSenderInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'NA';

function MessageRow({ message, onReplySuccess }: {
  message: ContactMessageRecord;
  onReplySuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  const handleReply = async () => {
    if (replyBusy || !replyText.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    setReplySuccess(null);
    const response = await contactMessagesApi.replyToMessage(message.id, replyText.trim());
    setReplyBusy(false);
    if (response.error) {
      setReplyError(response.error);
      return;
    }
    setReplySuccess(`Reply sent to ${message.email}.`);
    setReplyText('');
    onReplySuccess();
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04]"
      >
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.06] text-sm font-semibold text-white ring-1 ring-white/10">
          {getSenderInitials(message.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {message.subject || 'No subject'}
            </p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusTone(message.status)}`}>
              {getStatusLabel(message.status)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
            <span className="truncate">{message.name}</span>
            <span>·</span>
            <span className="shrink-0">{formatRelativeTime(message.created_at)}</span>
          </div>
          {!open && (
            <p className="mt-1 truncate text-xs text-white/50">{message.message}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">From</p>
            <p className="mt-1 text-sm text-white">
              {message.name}{' '}
              <span className="text-sky-300">&lt;{message.email}&gt;</span>
            </p>
            {message.sender_identifier && (
              <p className="mt-0.5 text-xs text-white/40">{message.sender_role} · {message.sender_identifier}</p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">Message</p>
            <p className="mt-2 text-sm leading-7 text-white/80 whitespace-pre-wrap">{message.message}</p>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Reply</p>
            <textarea
              value={replyText}
              onChange={(e) => { setReplyText(e.target.value); setReplyError(null); setReplySuccess(null); }}
              rows={4}
              className="w-full rounded-[18px] border border-white/12 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white placeholder:text-white/35 focus:border-sky-300/35 focus:outline-none focus:ring-2 focus:ring-sky-300/20"
              placeholder={`Write your reply to ${message.name}...`}
            />

            {replyError && (
              <div className="rounded-[16px] border border-rose-300/25 bg-rose-500/15 px-4 py-3 text-sm text-rose-100 flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{replyError}</span>
              </div>
            )}
            {replySuccess && (
              <div className="rounded-[16px] border border-emerald-300/25 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{replySuccess}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleReply()}
                disabled={replyBusy || !replyText.trim()}
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactInboxPanel() {
  const [messagesState, setMessagesState] = useState<SectionState>('loading');
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setMessagesState('loading');
    const response = await contactMessagesApi.getMessages({ search, limit: 200 });
    if (response.error || !response.data) {
      setMessages([]);
      setMessagesError(response.error ?? 'Unable to load contact messages.');
      setMessagesState('error');
      setTotalCount(0);
      return;
    }
    setMessages(response.data.results);
    setTotalCount(response.data.total_count);
    setMessagesError(null);
    setMessagesState('idle');
  }, [search]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[22px] border border-white/12 bg-white/[0.04] px-11 py-3 text-sm text-white placeholder:text-white/35 focus:border-sky-300/35 focus:outline-none focus:ring-2 focus:ring-sky-300/20"
            placeholder="Search sender, subject, message..."
          />
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/45">
          {totalCount} total
        </span>
      </div>

      {messagesState === 'loading' && (
        <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-5 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin text-sky-100" />
          Loading messages...
        </div>
      )}

      {messagesError && (
        <div className="rounded-[24px] border border-rose-300/25 bg-rose-500/15 px-5 py-4 text-sm text-rose-100 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{messagesError}</span>
        </div>
      )}

      {messagesState !== 'loading' && !messagesError && messages.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.04] px-5 py-12 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-sky-100">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-4 text-base font-semibold text-white">No messages yet</p>
          <p className="mt-2 text-sm text-white/50">Messages from the contact form will appear here.</p>
        </div>
      )}

      {messagesState !== 'loading' && !messagesError && messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          onReplySuccess={() => void loadMessages({ silent: true })}
        />
      ))}
    </div>
  );
}
