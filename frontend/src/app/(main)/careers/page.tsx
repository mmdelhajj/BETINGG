export default function CareersPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">Careers</h1>
      <div className="bg-background-card border border-border rounded-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-text mb-3">Join Our Team</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          We are always looking for talented individuals to join our growing team. At CryptoBet, you will work on cutting-edge blockchain and gaming technology in a fast-paced, innovative environment.
        </p>
      </div>
      <div className="bg-background-card border border-border rounded-card p-6">
        <h2 className="text-lg font-semibold text-text mb-3">Open Positions</h2>
        <p className="text-text-muted text-sm">No open positions at this time. Check back soon or send your resume to careers@cryptobet.com.</p>
      </div>
    </div>
  );
}
