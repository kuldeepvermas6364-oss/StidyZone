import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { readSheet } from 'read-excel-file/browser';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAssessments } from '../../contexts/AssessmentContext';
import {
  confirmImportQuestionsApi,
  previewImportQuestionsApi,
  rollbackImportBatchApi,
} from '../../services/assessments/assessmentApi';
import type {
  QuestionImportBatch,
  QuestionImportMapping,
  QuestionImportPreviewResult,
} from '../../types/assessment';
import { gridRowsToObjects, parseCsvToRows } from '../../utils/questionImport';

const DEFAULT_MAPPING: QuestionImportMapping = {
  id: 'id',
  examTrack: 'examTrack',
  academicSession: 'academicSession',
  classLevel: 'classLevel',
  subjectId: 'subjectId',
  chapterId: 'chapterId',
  topicId: 'topicId',
  questionType: 'questionType',
  difficulty: 'difficulty',
  promptEn: 'promptEn',
  promptHi: 'promptHi',
  optionsEn: 'optionsEn',
  optionsHi: 'optionsHi',
  correctAnswer: 'correctAnswer',
  explanationEn: 'explanationEn',
  explanationHi: 'explanationHi',
  marks: 'marks',
  negativeMarks: 'negativeMarks',
  sourceType: 'sourceType',
  academicYear: 'academicYear',
};

const SAMPLE_CSV = [
  'id,examTrack,subjectId,chapterId,topicId,questionType,difficulty,promptEn,promptHi,optionsEn,optionsHi,correctAnswer,explanationEn,marks,negativeMarks',
  'qb-imp-demo-01,jee-main,jeemain-physics,jm-phy-ch1,jm-phy-c1-t1,mcq_single,easy,"What is the dimensional formula of Planck constant $h$?","प्लांक नियतांक $h$ का विमीय सूत्र क्या है?","$[ML^2T^{-1}]$|$[ML^2T^{-2}]$|$[MLT^{-1}]$|$[M^0L^2T^{-1}]$","$[ML^2T^{-1}]$|$[ML^2T^{-2}]$|$[MLT^{-1}]$|$[M^0L^2T^{-1}]$",A,"Since $E = h\\nu$, $[h] = [ML^2T^{-2}]/[T^{-1}] = [ML^2T^{-1}]$.",4,1',
  'qb-imp-demo-02,up-board-12,up12-physics,up12-phy-c1,up12-phy-c1-t1,true_false,easy,"Electrostatic force between two point charges in vacuum obeys inverse-square law.","निर्वात में दो बिंदु आवेशों के मध्य स्थिरवैद्युत बल व्युत्क्रम वर्ग नियम का पालन करता है।",,,true,"Coulomb law gives $F \\propto 1/r^2$.",1,0',
].join('\n');

export const QuestionImportPanel: React.FC = () => {
  const { language } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { importBatches, refreshAssessmentData } = useAssessments();

  const [sourceKind, setSourceKind] = useState<QuestionImportBatch['sourceKind']>('csv');
  const [rawText, setRawText] = useState('');
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedObjects, setParsedObjects] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<QuestionImportMapping>(DEFAULT_MAPPING);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [preview, setPreview] = useState<QuestionImportPreviewResult | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const applyObjects = (objects: Record<string, unknown>[], headers?: string[]) => {
    setParsedObjects(objects);
    const detectedHeaders =
      headers && headers.length > 0
        ? headers
        : objects[0]
        ? Object.keys(objects[0])
        : [];
    setParsedHeaders(detectedHeaders);

    // Auto-map matching column headers case-insensitively
    if (detectedHeaders.length > 0) {
      const lowerMap = new Map(detectedHeaders.map((h) => [h.toLowerCase().trim(), h]));
      const nextMap: QuestionImportMapping = { ...DEFAULT_MAPPING };
      (Object.keys(DEFAULT_MAPPING) as Array<keyof QuestionImportMapping>).forEach((field) => {
        const match = lowerMap.get(field.toLowerCase());
        if (match) {
          nextMap[field] = match;
        }
      });
      setMapping(nextMap);
    }
    setPreview(null);
    setStatusMsg(null);
  };

  const handleParseText = (text: string, kind: QuestionImportBatch['sourceKind']) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedObjects([]);
      setParsedHeaders([]);
      setPreview(null);
      return;
    }

    try {
      if (kind === 'json') {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed)
          ? (parsed as Record<string, unknown>[])
          : Array.isArray(parsed?.questions)
          ? (parsed.questions as Record<string, unknown>[])
          : [];
        if (arr.length === 0) {
          setStatusMsg({
            type: 'err',
            text:
              language === 'hi'
                ? 'JSON में वैध प्रश्नों की सरणी नहीं मिली।'
                : 'JSON must be an array of question objects or { "questions": [...] }.',
          });
          return;
        }
        applyObjects(arr);
      } else {
        // Handle CSV or Tab-separated Google Sheets clipboard paste cleanly
        const normalizedText =
          kind === 'google_sheets' && text.includes('\t') && !text.includes(',')
            ? text
                .split(/\r?\n/)
                .map((line) =>
                  line
                    .split('\t')
                    .map((cell) => `"${cell.replace(/"/g, '""')}"`)
                    .join(',')
                )
                .join('\n')
            : text;
        const rows = parseCsvToRows(normalizedText);
        const { headers, objects } = gridRowsToObjects(rows);
        if (objects.length === 0) {
          setStatusMsg({
            type: 'err',
            text: language === 'hi' ? 'फ़ाइल में कोई डेटा पंक्ति नहीं मिली।' : 'No data rows detected after header.',
          });
          return;
        }
        applyObjects(objects, headers);
      }
    } catch {
      setStatusMsg({
        type: 'err',
        text: language === 'hi' ? 'डेटा पार्स करने में त्रुटि।' : 'Failed to parse input text.',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    const ext = file.name.toLowerCase();

    try {
      if (ext.endsWith('.xlsx')) {
        setSourceKind('xlsx');
        const rows = await readSheet(file);
        const { headers, objects } = gridRowsToObjects(rows as unknown[][]);
        if (objects.length === 0) {
          setStatusMsg({
            type: 'err',
            text: language === 'hi' ? 'Excel शीट में कोई डेटा पंक्ति नहीं मिली।' : 'No rows found in Excel sheet.',
          });
          return;
        }
        applyObjects(objects, headers);
      } else if (ext.endsWith('.json')) {
        setSourceKind('json');
        const text = await file.text();
        handleParseText(text, 'json');
      } else {
        setSourceKind('csv');
        const text = await file.text();
        handleParseText(text, 'csv');
      }
    } catch {
      setStatusMsg({
        type: 'err',
        text: language === 'hi' ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Could not read uploaded file.',
      });
    }
  };

  const handleFetchGoogleSheetPublic = async () => {
    const trimmed = sheetIdInput.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      // Supports either full spreadsheet URL or spreadsheet ID for public CSV export, or directs Workspace OAuth
      const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const spreadsheetId = idMatch ? idMatch[1] : trimmed;
      const csvExportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv`;
      const resp = await fetch(csvExportUrl);
      if (!resp.ok) throw new Error('SHEET_FETCH_ERROR');
      const text = await resp.text();
      if (text.trim().startsWith('<')) {
        throw new Error('SHEET_REQUIRES_PUBLIC_OR_PASTE');
      }
      setSourceKind('google_sheets');
      handleParseText(text, 'google_sheets');
    } catch {
      setStatusMsg({
        type: 'err',
        text:
          language === 'hi'
            ? 'निजी Google Sheet सीधे लोड नहीं हो सकी। कृपया शीट से पंक्तियाँ कॉपी कर नीचे पेस्ट करें या सार्वजनिक CSV लिंक उपयोग करें।'
            : 'Could not fetch sheet anonymously (sheet may be private). Copy-paste rows directly below or share via CSV export.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunPreview = async () => {
    if (!isAuthenticated || !session) return;
    if (parsedObjects.length === 0) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await previewImportQuestionsApi(session, {
        rows: parsedObjects,
        mapping,
      });
      setPreview(res.preview);
    } catch {
      setStatusMsg({
        type: 'err',
        text: language === 'hi' ? 'प्रीव्यू सत्यापन विफल रहा।' : 'Failed to validate import rows.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!isAuthenticated || !session || parsedObjects.length === 0) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await confirmImportQuestionsApi(session, {
        rows: parsedObjects,
        mapping,
        sourceKind,
        skipDuplicates,
      });
      setConfirmModalOpen(false);
      setPreview(null);
      setParsedObjects([]);
      setRawText('');
      await refreshAssessmentData();
      setStatusMsg({
        type: 'ok',
        text:
          language === 'hi'
            ? `${res.insertedCount} प्रश्न सफलतापूर्वक बैंक में जोड़े गए (बैच ${res.batch.batchId})।`
            : `Imported ${res.insertedCount} questions successfully (Batch ${res.batch.batchId}).`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRollbackBatch = async (batchId: string) => {
    if (!isAuthenticated || !session) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await rollbackImportBatchApi(session, batchId);
      await refreshAssessmentData();
      setStatusMsg({
        type: 'ok',
        text:
          language === 'hi'
            ? `बैच ${batchId} से ${res.removedCount} प्रश्न रोलबैक किए गए।`
            : `Rolled back ${res.removedCount} questions from batch ${batchId}.`,
      });
    } catch {
      setStatusMsg({
        type: 'err',
        text: language === 'hi' ? 'रोलबैक विफल रहा।' : 'Batch rollback failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prepzone_questions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredMapFields: Array<{ key: keyof QuestionImportMapping; label: string }> = useMemo(
    () => [
      { key: 'examTrack', label: 'examTrack *' },
      { key: 'subjectId', label: 'subjectId *' },
      { key: 'chapterId', label: 'chapterId *' },
      { key: 'questionType', label: 'questionType *' },
      { key: 'difficulty', label: 'difficulty' },
      { key: 'promptEn', label: 'promptEn *' },
      { key: 'promptHi', label: 'promptHi' },
      { key: 'optionsEn', label: 'optionsEn (A|B|C|D)' },
      { key: 'correctAnswer', label: 'correctAnswer *' },
      { key: 'marks', label: 'marks' },
      { key: 'negativeMarks', label: 'negativeMarks' },
    ],
    []
  );

  return (
    <section
      aria-labelledby="import-hub-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="import-hub-heading" className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {language === 'hi' ? 'प्रश्न बैंक आयात (CSV / Excel / Google Sheets / JSON)' : 'Question Import Hub (CSV · Excel · Google Sheets · JSON)'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {language === 'hi'
              ? 'कॉलम मैपिंग, पंक्ति-स्तरीय त्रुटि जाँच, डुप्लिकेट पहचान, लाइव पूर्वावलोकन और रोलबैक सहायता।'
              : 'Supports column mapping, schema validation, duplicate detection, pre-import preview, confirmation, and batch rollback.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSourceKind('csv');
              handleParseText(SAMPLE_CSV, 'csv');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>{language === 'hi' ? 'नमूना CSV भरें' : 'Load Sample CSV'}</span>
          </button>
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>{language === 'hi' ? 'टेम्पलेट डाउनलोड' : 'CSV Template'}</span>
          </button>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {language === 'hi'
            ? 'प्रश्न बैंक में नया बैच आयात करने के लिए साइन इन आवश्यक है।'
            : 'Sign in with a student/educator account to preview, confirm, and rollback imported question batches.'}{' '}
          <Link to="/login?next=/practice-tests" className="font-semibold underline">
            {language === 'hi' ? 'लॉगिन करें' : 'Sign In'}
          </Link>
        </div>
      )}

      {/* Source Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            { id: 'csv', label: 'CSV' },
            { id: 'xlsx', label: 'Excel (.xlsx)' },
            { id: 'google_sheets', label: 'Google Sheets' },
            { id: 'json', label: 'JSON' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSourceKind(tab.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              sourceKind === tab.id
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input Area per Source */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>
              {sourceKind === 'xlsx'
                ? language === 'hi'
                  ? 'Excel (.xlsx) फ़ाइल चुनें'
                  : 'Choose .xlsx File'
                : sourceKind === 'json'
                ? language === 'hi'
                  ? 'JSON फ़ाइल चुनें'
                  : 'Choose .json File'
                : language === 'hi'
                ? 'CSV फ़ाइल अपलोड करें'
                : 'Upload CSV File'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {parsedObjects.length > 0
              ? language === 'hi'
                ? `${parsedObjects.length} पंक्तियाँ पार्स की गईं`
                : `${parsedObjects.length} row(s) parsed`
              : language === 'hi'
              ? 'या नीचे सीधे पेस्ट करें'
              : 'or paste structured rows below'}
          </span>
        </div>

        {sourceKind === 'google_sheets' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={sheetIdInput}
              onChange={(e) => setSheetIdInput(e.target.value)}
              placeholder="Google Sheet URL or Spreadsheet ID (shared view)..."
              aria-label="Google Spreadsheet URL or ID"
              className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              disabled={busy || !sheetIdInput.trim()}
              onClick={() => void handleFetchGoogleSheetPublic()}
              className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {language === 'hi' ? 'शीट लोड करें' : 'Fetch Sheet'}
            </button>
          </div>
        )}

        {sourceKind !== 'xlsx' && (
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => handleParseText(e.target.value, sourceKind)}
            placeholder={
              sourceKind === 'json'
                ? '[{"id":"qb-101","examTrack":"jee-main","subjectId":"jeemain-physics",...}]'
                : sourceKind === 'google_sheets'
                ? 'Paste copied Google Sheets cells (Tab or Comma separated with header row)...'
                : 'id,examTrack,subjectId,chapterId,questionType,difficulty,promptEn,optionsEn,correctAnswer...'
            }
            aria-label="Structured question import input"
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 p-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
          />
        )}
      </div>

      {/* Column Mapping Grid */}
      {parsedObjects.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {language === 'hi' ? 'कॉलम मैपिंग' : 'Column Mapping'}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {parsedHeaders.length} columns detected
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {requiredMapFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {f.label}
                </label>
                {parsedHeaders.length > 0 ? (
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">-- auto / default --</option>
                    {parsedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={mapping[f.key] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>
                {language === 'hi' ? 'डुप्लिकेट प्रश्न स्वतः छोड़ें' : 'Automatically skip duplicate IDs / prompts'}
              </span>
            </label>

            <button
              type="button"
              disabled={!isAuthenticated || busy}
              onClick={() => void handleRunPreview()}
              className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy
                ? language === 'hi'
                  ? 'जाँच हो रही है...'
                  : 'Validating...'
                : language === 'hi'
                ? 'प्रीव्यू और सत्यापन चलाएँ'
                : 'Validate & Preview Import'}
            </button>
          </div>
        </div>
      )}

      {/* Preview Validation Summary */}
      {preview && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Preview Summary · Total {preview.totalRows} · Valid {preview.validQuestions.length} · Errors{' '}
              {preview.rowErrors.length} · Duplicates {preview.duplicateIds.length + preview.duplicatePrompts.length}
            </span>
            {preview.validQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {language === 'hi' ? 'आयात की पुष्टि करें' : 'Review & Confirm Import'}
              </button>
            )}
          </div>

          {preview.rowErrors.length > 0 && (
            <ul className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-rose-200 bg-white p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-300">
              {preview.rowErrors.map((err, i) => (
                <li key={i}>
                  Row {err.rowNumber} ({err.field}): {err.message}
                </li>
              ))}
            </ul>
          )}

          {(preview.duplicateIds.length > 0 || preview.duplicatePrompts.length > 0) && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Duplicate IDs: {preview.duplicateIds.length}, Matching prompts: {preview.duplicatePrompts.length}
              </span>
            </p>
          )}
        </div>
      )}

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
          }`}
        >
          {statusMsg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Import Batch Rollback History */}
      {importBatches.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-2 dark:border-slate-800">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <History className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>{language === 'hi' ? 'हालिया आयात बैच (रोलबैक योग्य)' : 'Recent Import Batches (Rollback Supported)'}</span>
          </h3>
          <div className="space-y-2">
            {importBatches.map((batch) => (
              <div
                key={batch.batchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {batch.batchId} · {batch.sourceKind.toUpperCase()} · {batch.count} questions ·{' '}
                  {batch.importedAt.slice(0, 10)}
                </span>
                <button
                  type="button"
                  disabled={!isAuthenticated || busy}
                  onClick={() => void handleRollbackBatch(batch.batchId)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{language === 'hi' ? 'रोलबैक करें' : 'Rollback'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal */}
      {confirmModalOpen && preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-import-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 id="confirm-import-modal-title" className="font-display text-base font-bold text-slate-900 dark:text-white">
              {language === 'hi' ? 'प्रश्न बैंक में आयात की पुष्टि करें' : 'Confirm Question Bank Import'}
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {preview.validQuestions.length} validated question(s) from{' '}
              <strong>{sourceKind.toUpperCase()}</strong> will be inserted with rollback batch tracking.
              {skipDuplicates ? ' Duplicates will be skipped automatically.' : ''}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmImport()}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy
                  ? language === 'hi'
                    ? 'आयात हो रहा है...'
                    : 'Importing...'
                  : language === 'hi'
                  ? 'हाँ, आयात करें'
                  : 'Confirm & Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
