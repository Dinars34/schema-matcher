import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', maxWidth: '600px', margin: '40px auto' }}>
          <Card>
            <h2>Terjadi Kesalahan Aplikasi</h2>
            <p className="mu" style={{ marginBottom: '16px' }}>
              {this.state.errorMessage || 'Sistem mengalami kendala saat memuat komponen ini.'}
            </p>
            <Button variant="primary" onClick={() => window.location.assign('/submissions')}>
              Kembali ke Beranda Submissions
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}