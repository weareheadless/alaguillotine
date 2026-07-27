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
                Definitely Next Year
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF4500]/30 bg-[#FF4500]/10 px-4 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4500]">
                Status: Funding Secured.
              </span>
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            THE <span className="text-[#FF4500]">$CHOP</span> PROTOCOL
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-light italic leading-relaxed text-[#818384] sm:text-xl">
            A Whitepaper on Full Self-Decapitation (FSD), Vaporware Economics
            &amp; The Asset Class of Infinite Spite
          </p>

          <div className="mt-8 h-px w-24 bg-[#FF4500]/50" />
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
            gamer lights. We were promised a humanoid robot that would eliminate
            manual labor; we got a guy in a spandex morph-suit doing the robot
            dance. We were promised a colony on Mars; instead, we got a $44
            billion forced buyout of a bird app that now functions primarily as
            a megaphone for bot farms and crypto scams.
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

      {/* ─── Section 2: ASSET CLASS ────────────────────────────────────── */}
      <Section id="asset-class" title="2. The Asset Class of Global Unrest">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP is the world&rsquo;s first asset backed by the only truly
            renewable resource left on Earth:{" "}
            <span className="font-bold text-[#FF4500]">class rage.</span>
          </p>

          <p>
            You cannot short human misery. You cannot buy a call option on
            systemic collapse. But you can buy $CHOP.
          </p>

          <p>
            The macroeconomic reality is simple: Global unrest is going to get
            worse. Billionaires are going to keep siphoning wealth and acting
            insufferable. Buying $CHOP is essentially placing a long position on
            the inevitable collapse of late-stage capitalism. In many ways,
            investing in a worthless token backed by global suffering is a much
            safer long-term bet than buying SpaceX equity at the top. Rockets
            explode; human greed is forever.
          </p>

          <div className="rounded-lg border border-[#343536] bg-[#343536]/50 p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#818384]">
              📉 Just So You Know
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              The SpaceX IPO dropped <span className="font-bold text-[#ef4444]">50% in two weeks</span>.
              $CHOP has never lost a single token for anyone who held through
              their anger. We&rsquo;re not saying we&rsquo;re a safer investment.
              We&rsquo;re saying the math is the math.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 3: THE GUILLOTINE BOARD ───────────────────────────── */}
      <Section id="solution" title="3. The Guillotine Board">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP provides a public execution platform for your discontent. It
            is a digital Place de la R&eacute;volution, hosted at{" "}
            <a
              href="https://fuckyouelon.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#FF4500] underline underline-offset-2 decoration-[#FF4500]/40 hover:decoration-[#FF4500]"
            >
              fuckyouelon.net
            </a>
            .
          </p>

          <p>
            You are not buying a product. You are purchasing a billboard at the
            end of the world, and the price of admission is a token we
            explicitly designed to be hyper-deflationary.
          </p>

          <div className="space-y-4 rounded-lg border border-[#343536] bg-[#343536]/50 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">
                1
              </span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Acquire $CHOP</p>
                <p className="mt-1 text-sm text-[#818384]">
                  Buy $CHOP tokens on the open market as a hedge against dystopia.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">
                2
              </span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Send to Guillotine</p>
                <p className="mt-1 text-sm text-[#818384]">
                  Send your $CHOP to the protocol&rsquo;s designated
                  &ldquo;Guillotine Wallet.&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">
                3
              </span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Attach a Message</p>
                <p className="mt-1 text-sm text-[#818384]">
                  Express your feelings about the oligarch of the week.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4500]/20 text-sm font-bold text-[#FF4500]">
                4
              </span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Burn and Deflate</p>
                <p className="mt-1 text-sm text-[#818384]">
                  We burn the tokens. The supply shrinks. The unrest grows.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm italic text-[#818384]">
            Side note: Our CSS guillotine animation already drops frames less
            often than the X video player. We are out-shipping them.
          </p>
        </div>
      </Section>

      {/* ─── Section 4: HYPER-INFLATIONARY HYPE ────────────────────────── */}
      <Section id="hype" title="4. Hyper-Inflationary Hype &amp; &ldquo;Over-The-Air&rdquo; Disappointment">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            Deflation alone isn&rsquo;t enough to mimic the billionaire business
            model. To truly capture the magic, $CHOP introduces{" "}
            <span className="font-bold text-[#FF4500]">Hyper-Inflationary Hype</span>.
          </p>

          <p>
            We don&rsquo;t just wait for people to burn tokens; we actively
            manipulate the market through unachievable technical promises. We
            call this our{" "}
            <span className="font-bold text-[#D7DADC]">FSD (Full Self-Decapitation) Beta Program</span>.
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
              will pump 40% on the news alone.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#FF4500]">
              The Reality (What We Ship)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#FF6A33]">
              The update will literally just change the background color of the
              website from white to slightly off-white, or it will break the UI
              entirely so the blade gets stuck halfway down.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-base font-bold text-[#FF4500]">The Genius:</p>
            <p className="mt-1 text-sm text-[#D7DADC] leading-relaxed">
              When the community gets furious that the update is broken,{" "}
              <em>they will experience rage</em>. That rage feeds directly back
              into the tokenomics. They will buy more $CHOP just to burn it on
              the board complaining about the developers.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#D7DADC]">
              The bug is the feature. Our incompetence is a deflationary
              mechanism. This is Over-The-Air Disappointment as a Service.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 5: THE INFINITE SPITE FLYWHEEL ────────────────────── */}
      <Section id="flywheel" title="5. The Infinite Spite Flywheel">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            Because tokens are burned every time a message is posted, $CHOP
            relies on an endless loop of deflation tied directly to the news
            cycle.
          </p>

          <div className="space-y-3 rounded-lg border border-[#343536] bg-[#343536]/50 p-6">
            <div className="flex items-start gap-4">
              <span className="text-2xl">👔</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Catalyst</p>
                <p className="text-sm text-[#818384]">A billionaire does something infuriating. Global unrest compounds.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl">🛒</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Hedge</p>
                <p className="text-sm text-[#818384]">You buy $CHOP. It is the only logical hedge against the fact that you will never own a house.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Catharsis</p>
                <p className="text-sm text-[#818384]">You burn $CHOP to immortalize your rage on the Guillotine Board.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl">📉</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Hyper-Deflation</p>
                <p className="text-sm text-[#818384]">The circulating supply of $CHOP shrinks faster than the global middle class.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl">⚔️</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Blade Drops</p>
                <p className="text-sm text-[#818384]">The collective threshold is reached. Catharsis is achieved.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Infinite Queue</p>
                <p className="text-sm text-[#818384]">The moment Elon&rsquo;s digital head rolls, the mob immediately votes on the next target (Bezos, Zuck, the CEO of Nestl&eacute;). The board resets. The narrative never dies.</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Section 6: THE TREASURY ───────────────────────────────────── */}
      <Section id="treasury" title="6. The Treasury: Fighting the Good Fight (Or Not)">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP launched on pump.fun with a fixed supply of{" "}
            <span className="font-bold text-[#D7DADC]">1,000,000,000</span>{" "}
            tokens. There is no team allocation. There is no pre-mine.
          </p>

          <p>
            When you burn $CHOP to post a paid message, your tokens go to the
            Treasury. The Treasury burns a portion for your message and saves
            the rest to burn for free users, acting as a public good for those
            who are too poor to afford their own digital pitchforks.
          </p>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="font-semibold text-[#FF4500]">
              What happens to the leftover funds?
            </p>
            <p className="mt-2 text-sm text-[#D7DADC] leading-relaxed">
              We will use the remaining Treasury funds to fight the good fight
              and fund the revolution. Or, we might just use them to buy a
              private island, hoard resources, and escape the very dystopia we
              are protesting &mdash; effectively becoming the exact thing we set
              out to destroy. We haven&rsquo;t decided yet. But hey, at least
              we&rsquo;re honest about the grift.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 7: ROADMAP ────────────────────────────────────────── */}
      <Section id="roadmap" title="7. Roadmap (An Endless Conveyor Belt of Heads)">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-[#FF4500] via-[#FF4500]/30 to-transparent" />

          <TimelinePhase
            phase="Phase 1"
            title="Token Launch &amp; Elon&rsquo;s Block"
            description={
              <>
                $CHOP is live. The guillotine board is up. You can burn tokens
                to post messages. The blade is a CSS animation. It already drops
                frames less than the X video player.
              </>
            }
            status="Active ✅"
            statusColor="text-green-400"
            dotColor="bg-green-400"
          />

          <TimelinePhase
            phase="Phase 2"
            title='The Spite Engine — Q3 2026 / "Definitely Next Year"'
            description={
              <>
                Paid messages fund the Treasury. Posting becomes an act of
                philanthropy for the financially ruined. Every paid post is a
                flex AND a donation. Free users ride on whale coattails until
                the Treasury runs dry — then the cycle repeats.
              </>
            }
            status="Awaiting First Payer 🐳"
            statusColor="text-[#FF4500]"
            dotColor="bg-[#FF4500]"
          />

          <TimelinePhase
            phase="Phase 3"
            title="The Prediction Market — Q4 2026"
            description={
              <>
                &ldquo;Will the blade drop this month?&rdquo; Bet real $CHOP.
                Winners take all, losers get their tokens burned. It&rsquo;s
                prediction markets meets the French Revolution. Every bet creates
                token demand and reduces circulating supply. Accidental
                tokenomics.
              </>
            }
            status="Planned 🎲"
            statusColor="text-[#D7DADC]"
            dotColor="bg-[#D7DADC]"
          />

          <TimelinePhase
            phase="Phase 4"
            title="Decapitation Queue &amp; Voting — 2027"
            description={
              <>
                The mob decides who is next. Burn $CHOP to vote. Nominate new
                targets. Liquid democracy backed by liquid tokenomics. The queue
                never empties because the world never runs out of insufferable
                billionaires.
              </>
            }
            status="Planned"
            statusColor="text-[#818384]"
            dotColor="bg-[#818384]"
          />

          <TimelinePhase
            phase="Phase 5"
            title="xSpite AI &amp; Mars Guillotine — 2030+"
            description={
              <>
                We pivot to an AI company because AI is the new blockchain. We
                announce a Mars-based guillotine for interplanetary tax evaders.
                We raise $400M in a seed round without writing a single line of
                code. The website background changes to red. Nobody questions it.
              </>
            }
            status="Inevitable"
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
            <p className="text-sm leading-relaxed text-[#FF6A33]">
              <span className="font-bold text-[#FF4500]">$CHOP is a financial performance art project.</span>{" "}
              It is a cry for help formatted as a Solana token. Any expectation
              of profit is a glitch in your own psychology and a testament to
              the era of financial nihilism we all inhabit.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-sm leading-relaxed text-[#FF6A33]">
              <span className="font-bold text-[#FF4500]">The &ldquo;Guillotine Counter&rdquo; is a number on a screen.</span>{" "}
              It does not trigger a smart contract that redistributes wealth.
              Wealth redistribution would require a functional government, and
              we promised zero utility.
            </p>
          </div>

          <div className="rounded-lg border border-[#FF4500]/20 bg-[#FF4500]/5 p-5">
            <p className="text-sm leading-relaxed text-[#FF6A33]">
              <span className="font-bold text-[#FF4500]">This is a parody.</span>{" "}
              But so was the Dogefather SNL appearance. The line between satire
              and market-moving reality dissolved in 2021. You have been warned.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Closing Statement ─────────────────────────────────────────── */}
      <section className="border-b border-[#343536] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#FF4500]/20 bg-gradient-to-b from-[#FF4500]/5 to-transparent p-8 text-center">
            <p className="text-base leading-relaxed text-[#D7DADC]">
              This whitepaper constitutes a legally non-binding expression of
              contempt. $CHOP is best understood by asking:{" "}
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


