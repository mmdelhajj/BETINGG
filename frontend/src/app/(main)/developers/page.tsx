export default function DevelopersPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">API Documentation</h1>
      <div className="bg-background-card border border-border rounded-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">CryptoBet API</h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The CryptoBet API provides programmatic access to sports betting odds, casino games, wallet operations, and more. Our RESTful API uses JSON for request and response bodies, and supports JWT authentication.
        </p>
        <div className="bg-background-elevated rounded-button p-4 text-sm font-mono text-text-secondary">
          <p>Base URL: <span className="text-accent">https://api.cryptobet.com/api/v1</span></p>
          <p className="mt-1">Authentication: <span className="text-accent">Bearer Token (JWT)</span></p>
        </div>
      </div>
      <div className="bg-background-card border border-border rounded-card p-6">
        <h2 className="text-lg font-semibold text-text mb-3">Interactive Docs</h2>
        <p className="text-text-secondary text-sm">
          Visit our interactive Swagger documentation for detailed endpoint information, request/response schemas, and live testing.
        </p>
      </div>
    </div>
  );
}
