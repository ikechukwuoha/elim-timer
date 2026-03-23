'use client'

import Link from 'next/link'
import Image from 'next/image'

const CHURCH_NAME = 'Elim Christian Garden International'

export default function WelcomePage() {
  return (
    <div style={s.page}>
      <main style={s.main}>
        <div style={s.hero}>
          <div style={s.logoContainer}>
            <Image
              src="/church-logo.jpg"
              alt="Elim Christian Garden International Logo"
              width={120}
              height={120}
              style={s.logo}
              priority
            />
          </div>
          <h1 style={s.title}>{CHURCH_NAME}</h1>
          <p style={s.subtitle}>Welcome to our Church Service Timer Application</p>
          <p style={s.description}>
            Manage your worship service activities with precision timing, Bible verse display,
            song lyrics, images, and announcements. Perfect for seamless church presentations.
          </p>
          <div style={s.buttonGroup}>
            <Link href="/control" style={s.primaryButton}>
              🎛 Control Panel
            </Link>
            <Link href="/screen" style={s.secondaryButton}>
              📺 Big Screen Display
            </Link>
          </div>
        </div>

        <div style={s.features}>
          <h2 style={s.featuresTitle}>Features</h2>
          <div style={s.featureGrid}>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>⏱</div>
              <h3 style={s.featureTitle}>Activity Timer</h3>
              <p style={s.featureDesc}>Precise countdown timers for each service activity with visual progress indicators.</p>
            </div>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>✝</div>
              <h3 style={s.featureTitle}>Bible Display</h3>
              <p style={s.featureDesc}>Quick Bible verse lookup and display with multiple translations support.</p>
            </div>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>♪</div>
              <h3 style={s.featureTitle}>Song Lyrics</h3>
              <p style={s.featureDesc}>Display song lyrics line by line for congregational singing.</p>
            </div>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>🖼</div>
              <h3 style={s.featureTitle}>Image Gallery</h3>
              <p style={s.featureDesc}>Upload and display images for visual presentations.</p>
            </div>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>📢</div>
              <h3 style={s.featureTitle}>Announcements</h3>
              <p style={s.featureDesc}>Create and display church announcements and notices.</p>
            </div>
            <div style={s.featureCard}>
              <div style={s.featureIcon}>📺</div>
              <h3 style={s.featureTitle}>Big Screen</h3>
              <p style={s.featureDesc}>Dedicated display screen for projectors and large monitors.</p>
            </div>
          </div>
        </div>

        <div style={s.instructions}>
          <h2 style={s.instructionsTitle}>Getting Started</h2>
          <div style={s.steps}>
            <div style={s.step}>
              <div style={s.stepNumber}>1</div>
              <div style={s.stepContent}>
                <h3 style={s.stepTitle}>Access Control Panel</h3>
                <p style={s.stepDesc}>Click the "Control Panel" button above to manage your service activities.</p>
              </div>
            </div>
            <div style={s.step}>
              <div style={s.stepNumber}>2</div>
              <div style={s.stepContent}>
                <h3 style={s.stepTitle}>Set Up Activities</h3>
                <p style={s.stepDesc}>Add your service activities with durations in the Timer tab.</p>
              </div>
            </div>
            <div style={s.step}>
              <div style={s.stepNumber}>3</div>
              <div style={s.stepContent}>
                <h3 style={s.stepTitle}>Open Big Screen</h3>
                <p style={s.stepDesc}>Use the "Big Screen Display" button or visit /screen for the projector view.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style={s.footer}>
        <p style={s.footerText}>
          Built with ❤️ for {CHURCH_NAME}
        </p>
      </footer>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    color: '#fff',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4rem',
  },
  hero: {
    textAlign: 'center',
    padding: '4rem 2rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  logoContainer: {
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  logo: {
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: '3.5rem',
    fontWeight: 700,
    fontFamily: 'var(--font-bebas), cursive',
    marginBottom: '1rem',
    background: 'linear-gradient(45deg, #60a5fa, #a78bfa)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: '1.5rem',
    color: '#cbd5e1',
    marginBottom: '1.5rem',
    fontWeight: 300,
  },
  description: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    maxWidth: '600px',
    margin: '0 auto 2rem',
    lineHeight: 1.6,
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    background: 'linear-gradient(45deg, #22c55e, #16a34a)',
    color: '#fff',
    padding: '1rem 2rem',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
    display: 'inline-block',
  },
  secondaryButton: {
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    padding: '1rem 2rem',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: '1px solid #3b82f6',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
    display: 'inline-block',
  },
  features: {
    textAlign: 'center',
  },
  featuresTitle: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '3rem',
    fontFamily: 'var(--font-bebas), cursive',
    letterSpacing: '0.05em',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
  },
  featureCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '2rem',
    textAlign: 'center',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  featureIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  featureTitle: {
    fontSize: '1.3rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: '#e2e8f0',
  },
  featureDesc: {
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  instructions: {
    textAlign: 'center',
  },
  instructionsTitle: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '3rem',
    fontFamily: 'var(--font-bebas), cursive',
    letterSpacing: '0.05em',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    maxWidth: '600px',
    margin: '0 auto',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    textAlign: 'left',
  },
  stepNumber: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    background: 'linear-gradient(45deg, #22c55e, #16a34a)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: '#e2e8f0',
  },
  stepDesc: {
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)',
  },
  footerText: {
    color: '#64748b',
    fontSize: '0.9rem',
  },
}