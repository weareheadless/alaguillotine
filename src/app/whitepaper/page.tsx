"use client";

import { NavBar } from "@/components/NavBar";

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-[#D7DADC]">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      {/* ─── Hero Header ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#343536]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdib3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIiBzdHJva2U9IiMxZTI5M2IiIHN0cm9rZS13aWR0aD0iMC41Ii8+PC9zdmc+')] opacity-40" />

        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          {/* Status badges */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF4500]/30 bg-[#FF4500]/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF4500] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4500]">
                ⚠️ Status: Funding Secured.
              </span>
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            THE <span className="text-[#FF4500]">$CHOP</span> PROTOCOL
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-light italic leading-relaxed text-[#818384] sm:text-xl">
            A Whitepaper on Full Self-Decapitation (FSD), Proof-of-Hate Consensus
            &amp; The Asset Class of Infinite Spite
          </p>

          <div className="mt-8 h-px w-24 bg-[#FF4500]/50" />
        </div>
      </section>

      {/* ─── LEGAL DISCLAIMER ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-4 sm:px-6 lg:px-8">
        <div className="rounded-sm border-2 border-[#FF4500]/30 bg-[#FF4500]/5 p-6 font-mono text-sm leading-relaxed text-[#D7DADC]">
          <h2 className="mb-4 text-base font-bold text-[#FF4500] uppercase tracking-widest">
            NOTICE OF ARTISTIC SATIRE & SYMBOLIC REPRESENTATION
          </h2>
          <p className="mb-4">
            This website is an interactive digital art installation, a work of political satire, and a brutal commentary on modern tech conglomerates.
          </p>
          <div className="space-y-4">
            <p>
              <strong className="text-white">1. Public Figures as Symbols:</strong> Any reference to real individuals (especially those who own rocket companies or social media platforms) is used strictly as a <strong className="text-[#FF4500]">symbolic proxy for late-stage capitalism and corporate excess</strong>. These individuals are depicted not as private biological targets, but as archetypes of global economic friction.
            </p>
            <p>
              <strong className="text-white">2. Metaphorical Imagery:</strong> The guillotine is a historical metaphor for revolutionary market corrections. It is an artistic expression, not a literal threat. No physical harm is intended, encouraged, or implied.
            </p>
            <p>
              <strong className="text-white">3. Zero Utility &amp; Pure Speculation:</strong> The $CHOP token is a digital collectible with zero utility and no functional roadmap. Buying this token is an explicit act of financial self-harm and internet participation.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section 1: THE DOORWAY ────────────────────────────────────── */}
      <Section id="doorway" title="1. The Doorway: 15 Years of Unpunished Vaporware">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            To understand $CHOP, you must first understand the macroeconomic
            reality of the last 15 years. We have been conditioned to accept
            that actual utility is a bottleneck to market capitalization.
          </p>

          <p>
            In 2014, we were promised cars that would autonomously drive across
            the country while we slept. In 2026, the car still tries to swerve
            into oncoming traffic if it sees a brightly colored traffic cone,
            but the stock is up 10,000%. We were promised a high-speed vacuum
            Hyperloop; we got a one-lane dirt tunnel in Las Vegas with RGB
            gamer lights. We were promised a colony on Mars; instead, we got a
            $44 billion forced buyout of a bird app that now functions primarily
            as a megaphone for bot farms and crypto scams.
          </p>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-base font-bold text-[#FF4500]">
              The most successful business model of the 21st century is clear:
            </p>
            <p className="mt-1 text-lg font-semibold text-[#D7DADC]">
              Empty promises + Infinite hype + Zero accountability = Trillions in market cap.
            </p>
          </div>

          <p>
            He has extracted more value from undelivered vaporware than any
            human in history. The problem is that you have been rugged by a man
            who doesn&rsquo;t even need to hide it, and the financial system
            offers no native settlement layer for your resentment.
          </p>

          <p>
            Enter $CHOP. If he can build an empire on &ldquo;next year,&rdquo;
            we can build an economy on &ldquo;never.&rdquo;
          </p>
        </div>
      </Section>

      {/* ─── Section 2: PROOF-OF-SPITE ──────────────────────────────────── */}
      <Section id="pos" title="2. Proof-of-Spite (PoS) &amp; The Asset Class of Global Unrest">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP is the world&rsquo;s first asset backed by the only truly
            renewable resource left on Earth:{" "}
            <span className="font-bold text-[#FF4500]">class rage.</span>
          </p>

          <p>
            You cannot short human misery. You cannot buy a call option on
            systemic collapse. But you can buy $CHOP. We are pioneering a
            revolutionary new consensus mechanism:{" "}
            <span className="font-bold text-[#D7DADC]">Proof-of-Spite (PoS)</span>.
            The network is secured entirely by the collective outrage of the
            working class.
          </p>

          <p>
            Global unrest is going to get worse. Billionaires are going to keep
            acting insufferable. Buying $CHOP is essentially placing a long
            position on the inevitable collapse of late-stage capitalism. In
            many ways, investing in a worthless token backed by global suffering
            is a much safer long-term bet than buying SpaceX equity at the top.
            Rockets explode; human greed is forever.
          </p>
        </div>
      </Section>

      {/* ─── Section 3: THE DIGITAL GUILLOTINE ─────────────────────────── */}
      <Section id="guillotine" title="3. The Digital Guillotine (How It Works)">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP provides a public execution platform for your discontent. It
            is a digital <em>Place de la R&eacute;volution</em>. You are not
            buying a product. You are purchasing a billboard at the end of the
            world, funded by a hyper-deflationary engine.
          </p>

          <div className="space-y-4 rounded-lg border border-[#343536] bg-[#343536]/50 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">💰</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Paid Catharsis</p>
                <p className="mt-1 text-sm text-[#818384]">Burn $CHOP to post a message. The blade drops. The supply shrinks.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">🏦</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Treasury</p>
                <p className="mt-1 text-sm text-[#818384]">When you pay to post, your tokens go to the Treasury. The Treasury acts as a public good, burning its own capital to allow free users to drop the blade. Posting a paid message is an act of philanthropy for the financially ruined.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">🆓</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Free Loaders</p>
                <p className="mt-1 text-sm text-[#818384]">Can&rsquo;t afford $CHOP? Post for free. You actively drain the Treasury&rsquo;s capital and burn tokens on the whales&rsquo; dime. You post the jokes; the oligarchs foot the bill.</p>
              </div>
            </div>
          </div>

          <p className="text-sm italic text-[#818384]">
            Side note: Our CSS guillotine animation already drops frames less
            often than the X video player. We are out-shipping them.
          </p>
        </div>
      </Section>

      {/* ─── Section 4: THE VANGUARD VS THE PARASITES ──────────────────── */}
      <Section id="vanguard" title="4. The Vanguard vs. The Parasites">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>A revolution needs leaders, and it needs enemies.</p>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-6">
            <p className="font-bold text-[#FF4500]">THE COMMITTEE (The Vanguard)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              Meet the new bosses &mdash; exactly like the old bosses. The top 7
              largest spenders of $CHOP earn a seat on The Committee. Every epoch,
              this unelected politburo decides how the Treasury flows. Will they
              fund a lottery? Will they pay the developers? Will they distribute
              it to the free users? They bought the revolution, making them the
              exact central planners they claim to despise. Absolute power, funded
              by absolute wealth.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-6">
            <p className="font-bold text-[#FF4500]">CLASS TRAITORS (Wall of Shame)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              These individuals bought $CHOP and just sat on it, hoping to
              passively profit off the revolution like they inherited a South
              African emerald mine. No posts. No participation. Just pure, useless
              idle capital expecting the working class to do the heavy lifting.
              Zero voting power. Maximum public embarrassment.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 5: VOX POPULI ─────────────────────────────────────── */}
      <Section id="vox-populi" title="5. Vox Populi: The Infinite Queue">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            What happens when the blade hits the bottom? We clean the basket and
            start over.
          </p>

          <p>
            Because tokens are burned every time a message is posted, $CHOP
            relies on an endless loop of deflation tied directly to the news
            cycle. Every message cast is also a vote for{" "}
            <span className="font-bold text-[#D7DADC]">Next in Line</span>.
            Once the current digital head rolls, the mob immediately transitions
            to the next target &mdash; be it another tech-bro leech, a hedge fund
            sociopath, or an absentee CEO.
          </p>

          <p>
            The blade resets. The queue of untouchable elites never ends.
          </p>
        </div>
      </Section>

      {/* ─── Section 6: HYPER-INFLATIONARY HYPE ────────────────────────── */}
      <Section id="hype" title="6. Hyper-Inflationary Hype &amp; &ldquo;Over-The-Air&rdquo; Disappointment">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            Deflation alone isn&rsquo;t enough to mimic the billionaire business
            model. To truly capture the magic, $CHOP introduces{" "}
            <span className="font-bold text-[#FF4500]">Full Self-Decapitation (FSD) Beta</span>.
          </p>

          <p>Every few weeks, the protocol will announce a &ldquo;Software Update.&rdquo;</p>

          <div className="rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#22c55e]">
              The Promise (What We Tweet)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              &ldquo;Guillotine Neural Net v12.4 is dropping next week. It
              increases blade descent velocity by 15% and uses AI to
              algorithmically detect billionaire tax evasion.&rdquo; The token
              pumps 40% on the news alone.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#FF4500]">
              The Reality (What We Ship)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              We will literally just change the background color of the website
              from white to slightly off-white, or we will break the UI entirely
              so the blade gets stuck halfway down.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-base font-bold text-[#FF4500]">The Genius:</p>
            <p className="mt-1 text-sm text-[#D7DADC] leading-relaxed">
              When the community gets furious that the update is broken,{" "}
              <em>they will experience rage</em>. That rage feeds directly back
              into the tokenomics. They will buy more $CHOP just to burn it on
              the board complaining about the developers. Our incompetence is a
              deflationary mechanism. This is{" "}
              <span className="font-bold text-[#D7DADC]">Over-The-Air Disappointment as a Service</span>.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 7: ROADMAP ────────────────────────────────────────── */}
      <Section id="roadmap" title="7. Roadmap (An Endless Conveyor Belt of Heads)">
        <div className="relative">
          <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-[#FF4500] via-[#FF4500]/30 to-transparent" />

          <TimelinePhase
            phase="Phase 1"
            title="Token Launch & The Spite Engine"
            description={
              <>
                $CHOP is live. The Proof-of-Hate protocol is functional. The
                treasury is funding the digital mob.
              </>
            }
            status="Active ✅"
            statusColor="text-green-400"
            dotColor="bg-green-400"
          />

          <TimelinePhase
            phase="Phase 2"
            title="The Prediction Market"
            description={
              <>
                &ldquo;Will the blade drop this month?&rdquo; Bet real $CHOP.
                Winners take all, losers get their tokens burned. It&rsquo;s
                prediction markets meets the French Revolution.
              </>
            }
            status="Planned 🎲"
            statusColor="text-[#D7DADC]"
            dotColor="bg-[#D7DADC]"
          />

          <TimelinePhase
            phase="Phase 3"
            title="xSpite AI & Mars Guillotine"
            description={
              <>
                We pivot to an AI company because AI is the new blockchain. We
                announce a Mars-based guillotine for interplanetary tax evaders.
                We raise $400M in a seed round without writing a single line of
                code. The website background changes to red. Nobody questions it.
              </>
            }
            status="Inevitable 🚀"
            statusColor="text-purple-400"
            dotColor="bg-purple-400"
            isLast
          />
        </div>
      </Section>

      {/* ─── Section 8: DISCLAIMERS ──────────────────────────────────────── */}
      <Section id="disclaimers" title="8. Disclaimers (The Only Serious Part)">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#FF4500]">$CHOP is a financial performance art project.</span>{" "}
              It is a cry for help formatted as a Solana token. Any expectation
              of profit is a glitch in your own psychology and a testament to
              the era of financial nihilism we all inhabit.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#FF4500]">The &ldquo;Guillotine Counter&rdquo; is a number on a screen.</span>{" "}
              It does not trigger an automated smart contract. Any and all wealth
              redistribution is executed manually at the total discretion of our
              unelected Committee of top spenders. We bypassed trustless code in
              favor of backroom handshakes, proving once and for all that no
              matter how hard you protest, the guys with the most capital still
              pull the levers.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#FF4500]">This is a parody.</span>{" "}
              But so was the Dogefather SNL appearance. The line between satire
              and market-moving reality dissolved years ago. You have been warned.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Closing Statement ─────────────────────────────────────────── */}
      <section className="border-b border-[#343536] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#FF4500]/20 bg-gradient-to-b from-[#FF4500]/5 to-transparent p-8 text-center">
            <p className="text-base font-bold text-[#D7DADC]">
              This whitepaper constitutes a legally non-binding expression of contempt.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#D7DADC]">
              $CHOP is best understood by asking:{" "}
              <span className="italic text-[#D7DADC]">
                &ldquo;If he can build a $100B empire on stealing our data,
                lying about autonomous driving, and selling us vaporware, can
                we build an economy entirely on hating him for it?&rdquo;
              </span>
            </p>
            <p className="mt-4 text-lg font-bold text-[#FF4500]">
              The answer is yes. Send tokens to scream.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center">
        <p className="text-xs text-[#818384]">
          $CHOP Protocol &mdash; Full Self-Decapitation (FSD) Whitepaper
        </p>
        <p className="mt-1 text-[10px] text-[#475569]">
          Not financial advice. Not anything advice. This is a joke. Definitely. Probably.
        </p>
      </footer>
    </div>
  );
}

/* ─── Reusable Section Wrapper ──────────────────────────────────────────────── */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-b border-[#343536] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-[#D7DADC] sm:text-3xl">
          {title}
        </h2>
        <div className="mt-2 mb-8 h-px w-16 bg-[#FF4500]/50" />
        {children}
      </div>
    </section>
  );
}

/* ─── Timeline Phase Component ──────────────────────────────────────────────── */

function TimelinePhase({
  phase,
  title,
  description,
  status,
  statusColor,
  dotColor,
  isLast,
}: {
  phase: string;
  title: string;
  description: React.ReactNode;
  status: string;
  statusColor: string;
  dotColor: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-6 pb-12 last:pb-0">
      {/* Dot */}
      <div className="relative flex flex-col items-center">
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#343536] ${dotColor} shadow-[0_0_12px_rgba(220,38,38,0.15)]`}
        >
          <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        </div>
        {!isLast && <div className="absolute top-10 h-full w-px bg-[#343536]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#818384]">
            {phase}
          </span>
          <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
        </div>
        <h3 className="mt-1 text-xl font-bold text-[#D7DADC]">{title}</h3>
        <p className="mt-2 text-sm text-[#818384] leading-relaxed max-w-2xl">
          {description}
        </p>
      </div>
    </div>
  );
}


