import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchSubmissionDetail, submitDecision } from '../api/review';
import type { DecisionPayload, SchemaColumn } from '../api/review';
import type { Verdict } from '../api/submissions';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';

const MANUAL_VERDICTS: Verdict[] = ['new_dataset', 'new_source', 'enrichment', 'duplicate'];

function getVerdictVariant(verdict: Verdict) {
  if (verdict === 'enrichment' || verdict === 'new_dataset' || verdict === 'new_source') return 'success';
  if (verdict === 'needs_review') return 'warning';
  return 'error';
}

function renderColumns(columns: SchemaColumn[], matchedColumns: SchemaColumn[]) {
  const matchedNames = new Set(matchedColumns.map((column) => column.name.toLocaleLowerCase()));
  return columns.map((column, index) => {
    const isNew = !matchedNames.has(column.name.toLocaleLowerCase());
    return {
      key: `${column.name}-${index}`,
      className: isNew ? 'add' : '',
      cells: [
        <span>
          {column.name}
          {isNew && matchedColumns.length > 0 && <Badge label="baru" variant="success" />}
        </span>,
        column.data_type,
      ],
    };
  });
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [manualVerdict, setManualVerdict] = useState<Verdict | ''>('');
  const [showVerdictOverride, setShowVerdictOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.submission(id ?? ''),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('ID submission tidak valid.');
      return fetchSubmissionDetail(id, signal);
    },
    enabled: Boolean(id),
  });
  const detail = detailQuery.data;
  const proposal = detail?.proposal;
  const incomingColumns = proposal?.incoming.columns ?? [];
  const matchedColumns = proposal?.matched?.schema_card.columns ?? [];
  const currentVerdict = manualVerdict || detail?.verdict || proposal?.verdict;
  const isPendingDecision = detail?.status === 'draft' && Boolean(proposal);
  const needsManualVerdict = currentVerdict === 'needs_review' && !manualVerdict;

  const decisionMutation = useMutation({
    mutationFn: (payload: DecisionPayload) => {
      if (!id) throw new Error('ID submission tidak valid.');
      return submitDecision(id, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['submissions'] }),
        queryClient.invalidateQueries({ queryKey: id ? queryKeys.submission(id) : ['submission'] }),
        queryClient.invalidateQueries({ queryKey: ['datasets'] }),
        queryClient.invalidateQueries({ queryKey: ['dataset-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
      ]);
      navigate('/submissions');
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const handleDecision = (action: DecisionPayload['action']) => {
    if (!detail || !proposal || decisionMutation.isPending) return;
    const reviewerName = localStorage.getItem('reviewer_name')?.trim();
    if (!reviewerName) {
      setError('Atur nama reviewer di halaman Pengaturan sebelum menyimpan keputusan.');
      return;
    }
    if (action === 'accept' && currentVerdict === 'needs_review' && !manualVerdict) {
      setError('Pilih verdict manual sebelum menerima proposal needs_review.');
      return;
    }

    setError(null);
    decisionMutation.mutate({
      action,
      verdict: action === 'accept' ? (manualVerdict || proposal.verdict) : undefined,
      target_entry_id: proposal.matched?.entry_id,
      decided_by: reviewerName,
    });
  };

  if (detailQuery.isPending) {
    return <p className="mu" style={{ padding: '24px' }}>Memuat proposal review...</p>;
  }
  if (detailQuery.isError) {
    return (
      <div style={{ padding: '24px' }}>
        <p role="alert" style={{ color: 'var(--ert)' }}>
          Gagal memuat submission: {detailQuery.error.message}
        </p>
        <Button onClick={() => navigate('/submissions')}>Kembali ke submission</Button>
      </div>
    );
  }
  if (!detail) return null;

  const incomingRows = renderColumns(incomingColumns, matchedColumns);
  const catalogRows = matchedColumns.map((column, index) => ({
    key: `${column.name}-${index}`,
    cells: [column.name, column.data_type],
  }));
  const verdict = currentVerdict;

  return (
    <>
      <PageHeader title={`Review proposal: ${detail.file_name}`}>
        {verdict && <Badge label={verdict} variant={getVerdictVariant(verdict)} />}
        {proposal && (
          <span className="mono" style={{ color: 'var(--mu)' }}>
            similarity {proposal.similarity.toFixed(3)}
          </span>
        )}
      </PageHeader>

      {error && (
        <div role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          <strong>Keputusan tidak tersimpan:</strong> {error}
        </div>
      )}

      <Card>
        <h2>Ringkasan submission</h2>
        <dl className="review-summary">
          <div>
            <dt>Status</dt>
            <dd>{detail.status}</dd>
          </div>
          <div>
            <dt>Diunggah</dt>
            <dd>{new Date(detail.uploaded_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Keputusan</dt>
            <dd>
              {detail.decision
                ? `${detail.decision.action} oleh ${detail.decision.decided_by || '—'} pada ${new Date(detail.decision.decided_at).toLocaleString()}`
                : 'Belum ada keputusan reviewer.'}
            </dd>
          </div>
          <div className="wide">
            <dt>Alasan judge</dt>
            <dd>{proposal?.reason ?? detail.reason_short ?? 'Alasan judge belum tersedia dari server.'}</dd>
          </div>
          <div className="wide">
            <dt>Entri katalog yang cocok</dt>
            <dd>{proposal?.matched?.dataset ?? 'Tidak ada entri katalog yang dipasangkan.'}</dd>
          </div>
        </dl>
      </Card>

      {!proposal && (
        <Card>
          Proposal belum tersedia dari server untuk submission ini.
        </Card>
      )}

      {proposal && (
        <div className="g2">
          <Card>
            <h2>Schema masuk</h2>
            <Table headers={['Kolom', 'Tipe']} rows={incomingRows} />
            <p className="mu" style={{ marginTop: '12px' }}>
              Tahun: {proposal.incoming.years.join(', ') || '—'}
            </p>
          </Card>
          <Card>
            <h2>Entri katalog yang cocok</h2>
            {proposal.matched ? (
              <>
                <p className="review-match-name">{proposal.matched.dataset}</p>
                <p className="mono">Entry ID: {proposal.matched.entry_id}</p>
                <Table headers={['Kolom', 'Tipe']} rows={catalogRows} />
                <p className="mu" style={{ marginTop: '12px' }}>
                  Tahun: {proposal.matched.schema_card.years.join(', ') || '—'}
                </p>
              </>
            ) : (
              <p className="mu">Proposal tidak menunjuk ke entri katalog tertentu.</p>
            )}
          </Card>
        </div>
      )}

      {showVerdictOverride && isPendingDecision && (
        <Card>
          <h2>Ubah verdict manual</h2>
          <label htmlFor="manual-verdict">Verdict</label>
          <select
            id="manual-verdict"
            value={manualVerdict}
            onChange={(event) => {
              const value = event.target.value;
              setManualVerdict(MANUAL_VERDICTS.find((candidate) => candidate === value) ?? '');
              setError(null);
            }}
          >
            <option value="">Pilih verdict</option>
            {MANUAL_VERDICTS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Card>
      )}

      {isPendingDecision && (
        <div className="end">
          <Button onClick={() => handleDecision('reject')} disabled={decisionMutation.isPending}>
            Tolak
          </Button>
          <Button onClick={() => setShowVerdictOverride((visible) => !visible)}>
            {showVerdictOverride ? 'Tutup pilihan verdict' : 'Ubah verdict'}
          </Button>
          <Button
            variant="primary"
            onClick={() => handleDecision('accept')}
            disabled={decisionMutation.isPending || needsManualVerdict}
          >
            {decisionMutation.isPending ? 'Memproses...' : 'Terima'}
          </Button>
        </div>
      )}
      {needsManualVerdict && (
        <p className="mu">
          Pilih verdict manual sebelum menerima proposal needs_review.
        </p>
      )}
    </>
  );
}
