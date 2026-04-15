import React from 'react';

interface BorrowSlipProps {
  studentName: string;
  studentId: string;
  courseYear: string;
  bookTitle: string;
  author: string;
  callNumber: string;
  dateBorrowed: string;
  dueDate: string;
}

const formatValue = (value: string, fallback = 'Not provided') => {
  const trimmed = value.trim();
  return trimmed || fallback;
};

const DetailRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <div className="grid gap-1 border-b border-slate-300/80 pb-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</dt>
    <dd className={`text-sm ${emphasis ? 'font-semibold text-slate-950' : 'text-slate-800'}`}>{value}</dd>
  </div>
);

export default function BorrowSlip({
  studentName,
  studentId,
  courseYear,
  bookTitle,
  author,
  callNumber,
  dateBorrowed,
  dueDate,
}: BorrowSlipProps) {
  const handlePrint = () => {
    window.print();
  };

  const displayStudentName = formatValue(studentName);
  const displayStudentId = formatValue(studentId);
  const displayCourseYear = formatValue(courseYear);
  const displayBookTitle = formatValue(bookTitle);
  const displayAuthor = formatValue(author, 'Unknown author');
  const displayCallNumber = formatValue(callNumber, 'To be assigned');
  const displayDateBorrowed = formatValue(dateBorrowed);
  const displayDueDate = formatValue(dueDate);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          .borrow-slip-shell,
          .borrow-slip-shell * {
            visibility: visible;
          }

          .borrow-slip-shell {
            position: absolute;
            inset: 0;
            margin: 0;
            width: 100%;
            max-width: none;
            padding: 0;
            background: #ffffff !important;
          }

          .borrow-slip-sheet {
            box-shadow: none !important;
            border: 1px solid #0f172a !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="borrow-slip-shell mx-auto max-w-[840px] bg-slate-100 p-4 sm:p-6">
        <div className="no-print mb-4 flex justify-end">
          <button
            onClick={handlePrint}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Print Borrow Slip
          </button>
        </div>

        <article className="borrow-slip-sheet overflow-hidden rounded-[28px] border border-slate-900 bg-white text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <header className="border-b border-slate-900 px-6 py-6 sm:px-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Official Library Form
                </p>
                <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[0.03em] text-slate-950">
                  Salazar Library System Borrow Slip
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  This slip serves as the official borrowing record for student-issued library
                  materials. Present and keep this document for reference until the borrowed item is
                  returned and cleared.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Due Date
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{displayDueDate}</p>
              </div>
            </div>
          </header>

          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border-b border-slate-200 px-6 py-6 sm:px-10 lg:border-b-0 lg:border-r">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Borrower Details
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Student Information</h2>
              </div>

              <dl className="space-y-4">
                <DetailRow label="Student Name" value={displayStudentName} />
                <DetailRow label="Student ID" value={displayStudentId} />
                <DetailRow label="Course / Year Level" value={displayCourseYear} />
                <DetailRow label="Date Borrowed" value={displayDateBorrowed} />
                <DetailRow label="Due Date" value={displayDueDate} emphasis />
              </dl>
            </section>

            <section className="px-6 py-6 sm:px-10">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Item Details
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Book Information</h2>
              </div>

              <dl className="space-y-4">
                <DetailRow label="Book Title" value={displayBookTitle} />
                <DetailRow label="Author" value={displayAuthor} />
                <DetailRow label="Call Number / Accession No." value={displayCallNumber} />
              </dl>

              <div className="mt-8 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Return Reminder
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  The borrowed book must be returned on or before the due date indicated on this
                  slip. Failure to return the item within the prescribed period may result in fines
                  or borrowing restrictions under library policy.
                </p>
              </div>
            </section>
          </div>

          <footer className="border-t border-slate-200 px-6 py-8 sm:px-10">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="h-14 border-b border-slate-900" />
                <p className="mt-3 text-center text-sm font-semibold text-slate-800">
                  Student Signature
                </p>
              </div>

              <div>
                <div className="h-14 border-b border-slate-900" />
                <p className="mt-3 text-center text-sm font-semibold text-slate-800">
                  Librarian Signature
                </p>
              </div>
            </div>

            <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-slate-500">
              Clean copy for printing and official library file reference
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
