'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { teacherRecordsApi, type TeacherRecordsImportResult, type TeacherRecordsSummary } from '@/lib/api';

type SectionState = 'idle' | 'loading' | 'error';

const TEMPLATE_COLUMNS = [
  'staff_id',
  'full_name',
  'school_email',
  'department',
  'academic_term',
  'is_active',
  'notes',
];

const TEMPLATE_CSV = `staff_id,full_name,school_email,department,academic_term,is_active,notes
T-2026-0001,Jane Teacher,jane.teacher@school.edu,Science,2025-2026,TRUE,Verified by HR
T-2026-0002,John Teacher,john.teacher@school.edu,Mathematics,2025-2026,FALSE,On leave
`;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'No uploads yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function LibrarianTeacherRecordsPage() {
  const [summaryState, setSummaryState] = useState<SectionState>('loading');
  const [summary, setSummary] = useState<TeacherRecordsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [academicTerm, setAcademicTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<TeacherRecordsImportResult | null>(null);

  const applySummaryResponse = useCallback((response: Awaited<ReturnType<typeof teacherRecordsApi.getSummary>>) => {
    if (response.error || !response.data) {
      setSummary(null);
      setSummaryError(response.error ?? 'Unable to load teacher records summary.');
      setSummaryState('error');
      return;
    }
    setSummary(response.data);
    setSummaryError(null);
    setSummaryState('idle');
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryState('loading');
    applySummaryResponse(await teacherRecordsApi.getSummary());
  }, [applySummaryResponse]);

  useEffect(() => {
    let cancelled = false;
    const fetchInitialSummary = async () => {
      const response = await teacherRecordsApi.getSummary();
      if (!cancelled) applySummaryResponse(response);
    };
    void fetchInitialSummary();
    return () => { cancelled = true; };
  }, [applySummaryResponse]);

  const columns = useMemo(
    () => summary?.template_columns?.length ? summary.template_columns : TEMPLATE_COLUMNS,
    [summary],
  );

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'teacher-records-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const response = await teacherRecordsApi.importCsv(selectedFile, academicTerm);
    setIsUploading(false);

    if (response.error || !response.data) {
      setUploadError(response.error ?? 'Unable to upload the teacher records CSV.');
      return;
    }

    setUploadResult(response.data);
    setSummary({
      total_records: response.data.total_records,
      active_records: response.data.active_records,
      inactive_records: response.data.inactive_records,
      latest_term: response.data.latest_term,
      last_updated_at: response.data.last_updated_at,
      template_columns: response.data.template_columns,
    });
    setSelectedFile(null);
    setAcademicTerm('');
  };

  return (
    <ProtectedRoute requiredRoles={['LIBRARIAN', 'ADMIN']}>
      <div className="min-h-screen overflow-hidden bg-[#060b16] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,16,28,0.96),rgba(9,20,37,0.86)_48%,rgba(7,13,23,0.96))]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/65">
                Faculty Control
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Upload teacher / faculty records CSV
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Keep teacher registration tied to the approved faculty list. Upload a CSV here and the
                register page will only allow faculty IDs found in this list to continue.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadSummary()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/20 hover:bg-sky-400/10"
              >
                <RefreshCw className={`h-4 w-4 ${summaryState === 'loading' ? 'animate-spin' : ''}`} />
                Refresh summary
              </button>
              <Link
                href="/librarian"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to librarian desk
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <div className="rounded-[32px] border border-white/12 bg-white/[0.05] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
                    Browser Upload
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Import the current faculty list</h2>
                  <p className="mt-2 max-w-2xl text-sm text-white/65">
                    The CSV must include a `staff_id` column. Existing rows are updated by faculty ID,
                    and new rows are created automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15"
                >
                  <Download className="h-4 w-4" />
                  Download template
                </button>
              </div>

              <form onSubmit={handleUpload} className="mt-8 space-y-6">
                <div className="rounded-[28px] border border-dashed border-sky-300/25 bg-sky-400/[0.05] p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-100">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="text-sm font-semibold text-white">Teacher records CSV file</label>
                      <p className="mt-1 text-sm text-white/60">
                        Accepted format: `.csv`, UTF-8 encoded, with one row per faculty member.
                      </p>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] ?? null);
                          if (uploadError) setUploadError(null);
                        }}
                        className="mt-4 block w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#1a1b1f] hover:file:bg-amber-300"
                      />
                      {selectedFile ? (
                        <p className="mt-3 text-sm text-emerald-100">Selected: {selectedFile.name}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <label className="text-sm font-semibold text-white">Fallback academic term</label>
                    <p className="mt-1 text-sm text-white/60">
                      Used only when the CSV omits the `academic_term` column value on a row.
                    </p>
                    <input
                      value={academicTerm}
                      onChange={(event) => setAcademicTerm(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-sky-300/35 focus:outline-none focus:ring-2 focus:ring-sky-300/20"
                      placeholder="e.g. 2025-2026"
                    />
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-[#0b1729]/88 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Expected key</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Required column</p>
                        <p className="text-sm text-white/60">`staff_id`</p>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadError ? (
                  <div className="rounded-2xl border border-rose-300/25 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  </div>
                ) : null}

                {uploadResult ? (
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/15 px-4 py-4 text-sm text-emerald-100">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-semibold">{uploadResult.message}</p>
                        <p>
                          Created: {uploadResult.created_count} | Updated: {uploadResult.updated_count} |
                          Skipped: {uploadResult.skipped_count}
                        </p>
                        {uploadResult.skipped_rows.length > 0 ? (
                          <div className="rounded-xl border border-emerald-200/15 bg-black/10 p-3 text-xs text-emerald-50/90">
                            {uploadResult.skipped_rows.map((row) => (
                              <p key={row}>{row}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-white/55">
                    Uploads are available only to librarian and admin accounts.
                  </p>
                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-[#1a1b1f] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Upload teacher records CSV
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-[32px] border border-white/12 bg-white/[0.05] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">
                  Current Summary
                </p>
                {summaryError ? (
                  <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                    {summaryError}
                  </div>
                ) : null}
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0b1729]/88 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Records</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{summary?.total_records ?? 0}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">Active</p>
                      <p className="mt-2 text-xl font-semibold text-emerald-100">{summary?.active_records ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">Inactive</p>
                      <p className="mt-2 text-xl font-semibold text-amber-100">{summary?.inactive_records ?? 0}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">
                    <p className="font-semibold text-white">Latest academic term</p>
                    <p className="mt-1">{summary?.latest_term ?? 'No term tagged yet'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">
                    <p className="font-semibold text-white">Last updated</p>
                    <p className="mt-1">{formatDateTime(summary?.last_updated_at)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/12 bg-white/[0.05] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">
                  Accepted Columns
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {columns.map((column) => (
                    <span
                      key={column}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/75"
                    >
                      {column}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-6 text-white/60">
                  Rows missing `staff_id` are skipped. The upload updates matching faculty IDs instead of
                  creating duplicates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
