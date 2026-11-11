import { useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type * as XLSX from '@e965/xlsx';
import { uploadSubmission } from '../api/upload';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';
import { getSheetPreview, MAX_UPLOAD_BYTES, readWorkbook } from '../lib/workbook';
import type { WorkbookPreview } from '../lib/workbook';

export default function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspectionId = useRef(0);
  const previewRequestId = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile?: File) => {
    const requestId = ++inspectionId.current;
    ++previewRequestId.current;
    setError(null);
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSheet('');
    setPreview(null);

    if (!selectedFile) return;
    if (!/\.(xlsx|xls)$/i.test(selectedFile.name)) {
      setError('Hanya file Excel (.xlsx atau .xls) yang diperbolehkan.');
      return;
    }
    if (selectedFile.size === 0) {
      setError('File kosong dan tidak dapat dibaca.');
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('Ukuran file melebihi batas maksimum 50 MB.');
      return;
    }

    setFile(selectedFile);
    setInspecting(true);
    try {
      const parsedWorkbook = await readWorkbook(await selectedFile.arrayBuffer());
      if (requestId !== inspectionId.current) return;

      const availableSheets = parsedWorkbook.SheetNames;
      const initialSheet = availableSheets[0];
      const initialPreview = await getSheetPreview(parsedWorkbook, initialSheet);
      if (requestId !== inspectionId.current) return;
      setWorkbook(parsedWorkbook);
      setSheetNames(availableSheets);
      setSheet(initialSheet);
      setPreview(initialPreview);
    } catch (inspectionError: unknown) {
      if (requestId === inspectionId.current) {
        setFile(null);
        setError(
          inspectionError instanceof Error
            ? `File Excel tidak dapat dibaca: ${inspectionError.message}`
            : 'File Excel tidak dapat dibaca.',
        );
      }
    } finally {
      if (requestId === inspectionId.current) setInspecting(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    const requestId = ++previewRequestId.current;
    setSheet(sheetName);
    if (!workbook) return;
    try {
      const sheetPreview = await getSheetPreview(workbook, sheetName);
      if (requestId !== previewRequestId.current) return;
      setPreview(sheetPreview);
      setError(null);
    } catch (previewError: unknown) {
      if (requestId !== previewRequestId.current) return;
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : 'Sheet tidak dapat dibaca.');
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFileSelect(event.dataTransfer.files[0]);
  };

  const handleUploadSubmit = async () => {
    if (!file || !sheet || !workbook || loading || inspecting) return;

    setLoading(true);
    setError(null);
    try {
      const upload = await uploadSubmission(file, sheet);
      await queryClient.invalidateQueries({ queryKey: ['submissions'] });
      const jobParams = new URLSearchParams({
        submission_id: upload.submission_id,
        file_name: upload.file_name,
      });
      navigate(`/jobs/${encodeURIComponent(upload.job_id)}?${jobParams.toString()}`, {
        state: { submissionId: upload.submission_id, fileName: upload.file_name },
      });
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah file.');
      setLoading(false);
    }
  };

  const previewRows = (preview?.rows ?? []).map((cells, index) => ({
    key: `${sheet}-${index}`,
    cells,
  }));

  return (
    <>
      <PageHeader title="Unggah file Excel" />

      {error && (
        <div role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        className={`drop ${isDragging ? 'on' : ''}`}
        id="dz"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <p style={{ font: '600 18px var(--f)', margin: '0 0 4px' }}>Seret dan lepas file Excel di sini</p>
        <p className="mu" style={{ margin: '0 0 16px' }}>atau</p>
        <Button onClick={() => fileInputRef.current?.click()} disabled={loading || inspecting}>
          Pilih file
        </Button>
        <input
          ref={fileInputRef}
          id="fi"
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(event) => {
            void handleFileSelect(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>

      <Card className="g2">
        <div>
          <p className="mu">File terpilih</p>
          <p id="fn" style={{ margin: '4px 0 0', fontWeight: 500 }}>
            {file?.name ?? 'Belum ada file dipilih'}
          </p>
          {file && <p className="mu">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
        </div>
        <div>
          <label htmlFor="sh">Sheet</label>
          <select
            id="sh"
            value={sheet}
            onChange={(event) => void handleSheetChange(event.target.value)}
            disabled={!sheetNames.length || inspecting || loading}
          >
            {sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </Card>

      <div>
        <h2>Pratinjau (5 baris pertama)</h2>
        <Card style={{ padding: '8px 12px' }}>
          {inspecting && <p className="mu" style={{ padding: '12px' }}>Membaca workbook...</p>}
          {!inspecting && !file && <p className="mu" style={{ padding: '12px' }}>Pilih file untuk melihat pratinjau.</p>}
          {!inspecting && file && preview && preview.headers.length > 0 && (
            <Table headers={preview.headers} rows={previewRows} />
          )}
          {!inspecting && file && preview?.headers.length === 0 && (
            <p className="mu" style={{ padding: '12px' }}>Sheet ini belum memiliki data untuk ditampilkan.</p>
          )}
        </Card>
      </div>

      <div className="end">
        <Button
          variant="primary"
          onClick={handleUploadSubmit}
          disabled={!file || !sheet || !workbook || loading || inspecting}
        >
          {loading ? 'Memulai analisis...' : 'Mulai analisis'}
        </Button>
      </div>
    </>
  );
}
