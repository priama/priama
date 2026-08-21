import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  region: string
  fallbackClassName?: string
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.region}]`, error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className={`flex flex-col items-center justify-center gap-3 p-6 ${this.props.fallbackClassName ?? 'flex-1'}`}>
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Something went wrong in {this.props.region}
        </p>
        {this.state.error.message ? (
          <p className="max-w-md break-words text-center text-xs text-muted-foreground/80">
            {this.state.error.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }
}
