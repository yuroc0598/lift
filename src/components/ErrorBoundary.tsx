import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'

export default class ErrorBoundary extends Component<{ children: ReactNode; onRecover: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lift recovered from a rendering error.', error, info)
  }

  recover = () => {
    this.props.onRecover()
    this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="recovery-screen">
        <ShieldAlert />
        <h1>That screen could not load</h1>
        <p>Your completed history is still stored locally. Return to the dashboard and export a CSV if the issue continues.</p>
        <button className="primary-button" onClick={this.recover}><RotateCcw /> Return to dashboard</button>
      </main>
    )
  }
}
