import React from 'react';
import { Result, Button } from 'antd';

/**
 * Global Error Boundary — catches unhandled render errors
 * and displays a clean fallback UI instead of a blank screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            extra={[
              <Button type="primary" key="retry" onClick={this.handleReset}>
                Try Again
              </Button>,
              <Button key="home" onClick={() => { this.handleReset(); window.location.href = '/'; }}>
                Go to Dashboard
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
