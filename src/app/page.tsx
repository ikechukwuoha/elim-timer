import Image from 'next/image'
import Link from 'next/link'
import styles from './page.module.css'

const CHURCH_NAME = 'Elim Christian Garden International'

const navItems = [
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Workspaces', href: '#workspaces' },
  { label: 'Access', href: '#access' },
]

const systemCoverage = [
  {
    title: 'Service flow',
    items: [
      'Programme timing with countdown, progress, and overtime awareness',
      'Previous, next, reset, pause, and auto-advance control',
      'A dedicated big-screen output for the auditorium',
    ],
  },
  {
    title: 'Presentation tools',
    items: [
      'Bible lookup with translations, quick references, and keyword search',
      'Song library management with line-by-line lyric cueing',
      'Styled notices, image display, and instant blank-screen mode',
    ],
  },
  {
    title: 'Media and reporting',
    items: [
      'Video playback plus PDF, PPT, PPTX, ODP, and Google Slides support',
      'Minister alert scroller for live communication on screen',
      'Operator notes and monthly overtime reporting after service',
    ],
  },
]

const quickFacts = [
  {
    value: '8',
    label: 'screen modes',
    detail: 'Timer, Bible, songs, images, video, presentations, notices, and blank screen.',
  },
  {
    value: '2',
    label: 'live workspaces',
    detail: 'One operator-facing control panel and one congregation-facing display.',
  },
  {
    value: 'Live',
    label: 'content switching',
    detail: 'Move from timer to scripture, lyrics, media, and announcements in real time.',
  },
  {
    value: 'Reports',
    label: 'service follow-up',
    detail: 'Capture notes and review monthly overtime trends after each service window.',
  },
]

const featurePillars = [
  {
    eyebrow: 'Run Of Service',
    title: 'Keep the full schedule visible and under control.',
    description:
      'Build a clear programme, assign durations, and stay ahead of overruns from one timing dashboard.',
    bullets: [
      'Add activities and edit time allocations for each service segment.',
      'Start, pause, reset, move backward or forward, and auto-advance the programme.',
      'Watch activity progress, session totals, remaining time, and overtime at a glance.',
    ],
  },
  {
    eyebrow: 'Bible',
    title: 'Move from scripture search to live display quickly.',
    description:
      'The Bible workspace is built for fast retrieval during live ministry moments and smooth projector presentation.',
    bullets: [
      'Browse books and chapters across supported translations.',
      'Use quick references and keyword search to locate verses faster.',
      'Send selected verses directly to the big screen with one action.',
    ],
  },
  {
    eyebrow: 'Songs',
    title: 'Cue worship lyrics in step with the room.',
    description:
      'Prepare songs ahead of time and guide the congregation line by line as worship progresses.',
    bullets: [
      'Store song titles, artist details, and lyric lines in a reusable library.',
      'Present a song instantly and step through each line in order.',
      'Keep the timer visible alongside lyrics when pacing still matters.',
    ],
  },
  {
    eyebrow: 'Media',
    title: 'Handle visuals, video, and presentation assets in one place.',
    description:
      'The media layer supports the common formats teams need for services, special programmes, and announcements.',
    bullets: [
      'Upload and present images for sermon points, notices, or worship moments.',
      'Play videos and present PDF, PPT, PPTX, ODP, or Google Slides content.',
      'Switch media live without leaving the operator workflow.',
    ],
  },
  {
    eyebrow: 'Announcements',
    title: 'Communicate clearly before, during, and after the programme.',
    description:
      'Use projector-ready notices and attention tools that help the congregation stay informed without clutter.',
    bullets: [
      'Create regular, urgent, or celebration notices with styled presentation.',
      'Configure the minister alert scroller at the top or bottom of the screen.',
      'Blank the screen instantly or return to the live timer whenever needed.',
    ],
  },
  {
    eyebrow: 'Oversight',
    title: 'Review what happened after the service ends.',
    description:
      'The system is not only for live projection. It also helps operators track service performance over time.',
    bullets: [
      'Capture private operator notes during the service.',
      'Log timer sessions and generate monthly overtime summaries.',
      'Launch the big-screen window separately for projector or auditorium display.',
    ],
  },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Plan the programme',
    text: 'Set up the service order, define durations, and keep the entire run sheet visible before the meeting starts.',
  },
  {
    step: '02',
    title: 'Cue content quickly',
    text: 'Jump between Bible passages, songs, notices, images, videos, and presentations without breaking flow.',
  },
  {
    step: '03',
    title: 'Drive the auditorium screen',
    text: 'Keep the projector output clean while the operator panel stays focused on controls, status, and previews.',
  },
  {
    step: '04',
    title: 'Review service performance',
    text: 'Use notes and monthly overtime reports to learn where the programme is running long and improve future services.',
  },
]

const surfaces = [
  {
    title: 'Control Panel',
    path: '/control',
    description:
      'Open the operator workspace for timing, scripture, worship lyrics, media, notices, alerts, and reporting.',
    cta: 'Open Control Panel',
  },
  {
    title: 'Big Screen Display',
    path: '/screen',
    description:
      'Launch the congregation-facing screen for timers, verses, lyrics, videos, slides, images, and announcements.',
    cta: 'Open Big Screen',
  },
]

export default function WelcomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.orbPrimary} />
      <div className={styles.orbSecondary} />

      <header className={styles.siteHeader}>
        <div className={styles.container}>
          <div className={styles.navbar}>
            <Link href="/" className={styles.brandLink}>
              <div className={styles.navLogoWrap}>
                <Image
                  src="/church-logo.jpg"
                  alt={`${CHURCH_NAME} logo`}
                  width={56}
                  height={56}
                  className={styles.navLogo}
                  priority
                />
              </div>
              <div className={styles.brandText}>
                <p className={styles.navBrand}>{CHURCH_NAME}</p>
                <p className={styles.navSubline}>Service Timer And Presentation Suite</p>
              </div>
            </Link>

            <nav className={styles.navLinks} aria-label="Homepage sections">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className={styles.navActions}>
              <Link href="/control" className={styles.navPrimary}>
                Control Panel
              </Link>
              <Link href="/screen" className={styles.navSecondary}>
                Big Screen
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={`${styles.band} ${styles.heroBand}`}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCard}>
              <span className={styles.kicker}>Church service operations in one coordinated system</span>
              <h1 className={styles.title}>
                Run timing, scripture, lyrics, media, notices, and reporting from one polished home base.
              </h1>
              <p className={styles.lead}>
                Built for live worship services, this platform helps your team manage the flow of the programme
                while keeping the congregation screen clean, readable, and ready for every moment.
              </p>

              <div className={styles.tagRow}>
                <span className={styles.tag}>Service timing</span>
                <span className={styles.tag}>Bible presentation</span>
                <span className={styles.tag}>Worship lyrics</span>
                <span className={styles.tag}>Media and slides</span>
                <span className={styles.tag}>Alerts and notices</span>
                <span className={styles.tag}>Overtime reporting</span>
              </div>

              <div className={styles.actionRow}>
                <Link href="/control" className={styles.primaryAction}>
                  Open Control Panel
                </Link>
                <Link href="/screen" className={styles.secondaryAction}>
                  Open Big Screen
                </Link>
              </div>

              <p className={styles.actionMeta}>
                Use <code>/control</code> for live operation and <code>/screen</code> for the projector or auditorium view.
              </p>
            </div>

            <aside className={styles.heroPanel}>
              <div className={styles.panelHeader}>
                <p className={styles.panelEyebrow}>Platform coverage</p>
                <h2 className={styles.panelTitle}>A fuller website-style overview of the entire system</h2>
                <p className={styles.panelIntro}>
                  From service timing to media presentation and post-service review, the homepage now reflects the complete workflow.
                </p>
              </div>

              <div className={styles.showcaseGrid}>
                {systemCoverage.map((group) => (
                  <section key={group.title} className={styles.showcaseCard}>
                    <h3 className={styles.showcaseCardTitle}>{group.title}</h3>
                    <ul className={styles.showcaseList}>
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className={`${styles.band} ${styles.statsBand}`}>
          <div className={styles.container}>
            <div className={styles.statsGrid}>
              {quickFacts.map((fact) => (
                <article key={fact.label} className={styles.statCard}>
                  <p className={styles.statValue}>{fact.value}</p>
                  <p className={styles.statLabel}>{fact.label}</p>
                  <p className={styles.statDetail}>{fact.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className={`${styles.band} ${styles.sectionBand}`}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionKicker}>Core capabilities</span>
              <h2 className={styles.sectionTitle}>Everything the team can manage from the system</h2>
              <p className={styles.sectionText}>
                These sections mirror the real operator tools already available in the app, so the homepage tells the complete product story clearly.
              </p>
            </div>

            <div className={styles.featureGrid}>
              {featurePillars.map((feature) => (
                <article key={feature.title} className={styles.featureCard}>
                  <span className={styles.featureEyebrow}>{feature.eyebrow}</span>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDescription}>{feature.description}</p>
                  <ul className={styles.featureList}>
                    {feature.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className={`${styles.band} ${styles.bandTint}`}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionKicker}>Workflow</span>
              <h2 className={styles.sectionTitle}>How the service moves from prep to presentation</h2>
              <p className={styles.sectionText}>
                The app works best as a simple live-service sequence that starts with planning, continues with live control, and ends with review.
              </p>
            </div>

            <div className={styles.workflowGrid}>
              {workflowSteps.map((step) => (
                <article key={step.step} className={styles.workflowCard}>
                  <span className={styles.workflowStep}>{step.step}</span>
                  <h3 className={styles.workflowTitle}>{step.title}</h3>
                  <p className={styles.workflowText}>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workspaces" className={`${styles.band} ${styles.sectionBand}`}>
          <div className={styles.container}>
            <div className={styles.workspacesLayout}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionKicker}>Workspaces</span>
                <h2 className={styles.sectionTitle}>Two views, one service experience</h2>
                <p className={styles.sectionText}>
                  Operators and the congregation do not need the same interface. The system gives each side a purpose-built view designed for its job.
                </p>
              </div>

              <div className={styles.workspacesPanel}>
                <p className={styles.workspaceLead}>
                  The control side is built for precision and quick switching. The screen side is built for clarity, scale, and readability in the room.
                </p>
                <div className={styles.workspaceMiniGrid}>
                  <div className={styles.miniCard}>
                    <span className={styles.miniLabel}>Operator view</span>
                    <p>Timing, scripture lookup, lyrics, media cues, notices, alerts, and reporting tools.</p>
                  </div>
                  <div className={styles.miniCard}>
                    <span className={styles.miniLabel}>Audience view</span>
                    <p>Projector-ready timer, verses, lyrics, media, notices, and blank-screen control.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.surfaceGrid}>
              {surfaces.map((surface) => (
                <article key={surface.path} className={styles.surfaceCard}>
                  <span className={styles.surfacePath}>{surface.path}</span>
                  <h3 className={styles.surfaceTitle}>{surface.title}</h3>
                  <p className={styles.surfaceDescription}>{surface.description}</p>
                  <Link href={surface.path} className={styles.surfaceLink}>
                    {surface.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="access" className={`${styles.band} ${styles.accessBand}`}>
          <div className={styles.container}>
            <div className={styles.accessCard}>
              <div className={styles.accessCopy}>
                <span className={styles.sectionKicker}>Direct access</span>
                <h2 className={styles.accessTitle}>Open the part of the system you need right now</h2>
                <p className={styles.accessText}>
                  Start in the control panel to run the service, then open the big-screen display for the projector or auditorium monitor.
                </p>
              </div>
              <div className={styles.accessActions}>
                <Link href="/control" className={styles.primaryAction}>
                  Go To Control Panel
                </Link>
                <Link href="/screen" className={styles.secondaryAction}>
                  Go To Big Screen
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrandBlock}>
              <p className={styles.footerBrand}>{CHURCH_NAME}</p>
              <p className={styles.footerText}>
                Service timing, presentation control, and projector-ready delivery for live worship gatherings.
              </p>
            </div>

            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Navigate</p>
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className={styles.footerLink}>
                  {item.label}
                </a>
              ))}
            </div>

            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Open</p>
              <Link href="/control" className={styles.footerLink}>
                Control Panel
              </Link>
              <Link href="/screen" className={styles.footerLink}>
                Big Screen Display
              </Link>
            </div>

            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Includes</p>
              <p className={styles.footerText}>Timer scheduling and overtime tracking</p>
              <p className={styles.footerText}>Bible, songs, notices, images, video, and slides</p>
              <p className={styles.footerText}>Operator notes, alerts, and monthly reporting</p>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>Built for live service teams who need clarity on stage and at the projector.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
