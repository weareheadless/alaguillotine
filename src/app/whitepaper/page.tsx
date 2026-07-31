"use client";

import { NavBar } from "@/components/NavBar";

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-[#D7DADC]">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      {/* ─── Hero Header: THE MANIFESTO ─────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#343536]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdib3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIiBzdHJva2U9IiMxZTI5M2IiIHN0cm9rZS13aWR0aD0iMC41Ii8+PC9zdmc+')] opacity-40" />

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Status badges */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E11D48]/30 bg-[#E11D48]/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#E11D48] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E11D48]">
                ⚠️ Status: Rage is renewable.
              </span>
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            THE <span className="text-[#E11D48]">MANIFESTO</span>
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-light italic leading-relaxed text-[#818384] sm:text-xl">
            This is not a whitepaper. Whitepapers are how they tell you what they&rsquo;re going to take from you.
            This is a declaration &mdash; for the angry, the done, and everyone who&rsquo;s been told
            &ldquo;it&rsquo;s complicated&rdquo; one too many times.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#manifesto"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-[#E11D48] bg-[#E11D48] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-[#E11D48]"
            >
              ⚔️ The Manifesto
            </a>
            <a
              href="#protocol"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-[#343536] bg-[#343536]/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D7DADC] transition-colors hover:border-[#E11D48] hover:text-[#E11D48]"
            >
              🔧 The CHOP Protocol
            </a>
          </div>
        </div>
      </section>

      {/* ─── LEGAL DISCLAIMER ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-4 sm:px-6 lg:px-8">
        <div className="rounded-sm border-2 border-[#E11D48]/30 bg-[#E11D48]/5 p-6 font-mono text-sm leading-relaxed text-[#D7DADC]">
          <h2 className="mb-4 text-base font-bold text-[#E11D48] uppercase tracking-widest">
            NOTICE OF ARTISTIC SATIRE & SYMBOLIC REPRESENTATION
          </h2>
          <p className="mb-4">
            This website is an interactive digital art installation, a work of political satire, and a brutal commentary on modern tech conglomerates.
          </p>
          <div className="space-y-4">
            <p>
              <strong className="text-white">1. Public Figures as Symbols:</strong> Any reference to real individuals (especially those who own rocket companies or social media platforms) is used strictly as a <strong className="text-[#E11D48]">symbolic proxy for late-stage capitalism and corporate excess</strong>. These individuals are depicted not as private biological targets, but as archetypes of global economic friction.
            </p>
            <p>
              <strong className="text-white">2. Metaphorical Imagery:</strong> The guillotine is a historical metaphor for revolutionary market corrections. It is an artistic expression, not a literal threat. No physical harm is intended, encouraged, or implied.
            </p>
            <p>
              <strong className="text-white">3. A Living Economic Experiment:</strong> The $CHOP token and its associated governance mechanisms constitute a real-time economic experiment in liquid democracy and AI-augmented collective decision-making. It is half art project, half political laboratory. Any expectation of profit is a symptom of the very late-stage capitalism this project satirizes.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ PART I — THE MANIFESTO ═══════════════ */}
      <PartLabel
        id="manifesto"
        label="PART I — THE MANIFESTO"
        subtitle="For the angry. For the done. For everyone who's been told 'it's complicated' one too many times."
      />

      {/* ─── Manifesto 1: THE PROBLEM ─────────────────────────────────── */}
      <ManifestoSection id="problem" title="1. The Problem: They Own Everything. Including the Story.">
        <div className="space-y-6">
          <p>
            Somewhere along the way we agreed to be managed. We&rsquo;re told what to fear, what to
            buy, who to hate &mdash; by people who own the algorithms, the media, the rockets, and most
            of the politicians. They named a child after a mathematician and a car after a terrorist
            because, in their world, branding is the only truth that matters.
          </p>
          <p>
            The last fifteen years were a masterclass: vaporware sold as destiny, debt sold as freedom,
            oligarchy sold as meritocracy. Every broken promise gets a press release. Every failure gets
            renamed &ldquo;disruption,&rdquo; and we&rsquo;re asked to be patient.
          </p>
          <div className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">
              We have been the audience of their confidence trick for long enough.
            </p>
          </div>
          <p>
            This site exists because &ldquo;being reasonable&rdquo; has been the most expensive decision
            of our generation.
          </p>
        </div>
      </ManifestoSection>

      {/* ─── Manifesto 2: THE IDEA ────────────────────────────────────── */}
      <ManifestoSection id="idea" title="2. The Idea: Rage Is the Only Renewable Resource Left.">
        <div className="space-y-6">
          <p>
            Every empire runs on a resource. Oil ran the last one. Data runs this one. But there&rsquo;s
            a resource they forgot to privatize:{" "}
            <span className="font-bold text-[#E11D48]">rage</span>.
          </p>
          <p>
            Rage is renewable. It regenerates every time a CEO announces layoffs as a &ldquo;synergy.&rdquo;
            Every time a promise evaporates into the next promise. Every time a billionaire explains
            that the economy is doing great from the deck of a yacht the size of your street.
          </p>
          <p>You can&rsquo;t short it. You can&rsquo;t mine it out. You can only point it.</p>
          <div className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">
              What happens when the people who&rsquo;ve been managed start organizing the one thing
              they were never able to take from us?
            </p>
          </div>
        </div>
      </ManifestoSection>

      {/* ─── Manifesto 3: THE DEMOCRACY ───────────────────────────────── */}
      <ManifestoSection id="democracy" title="3. The Democracy: One Human. One Voice.">
        <div className="space-y-6">
          <p>
            Every system they run is a pyramid: the more you have, the more you count. We&rsquo;re
            running the opposite one.
          </p>
          <p>
            On this site, one person gets one voice. It doesn&rsquo;t matter what you own, what you
            bought, or what you couldn&rsquo;t afford to buy. The whale and the broke student vote once
            each. The people who fund the machine don&rsquo;t get to steer it &mdash; that&rsquo;s not a bug,
            it&rsquo;s the entire point.
          </p>
          <p>
            There&rsquo;s no gatekeeper. No KYC. No &ldquo;community manager&rdquo; deciding who&rsquo;s
            worthy. You participate by showing up with a sentence&rsquo;s worth of anger and the guts to
            say it out loud. The rich don&rsquo;t get more votes. Nobody gets more votes. That&rsquo;s a
            line we&rsquo;re drawing, not a feature we&rsquo;re selling.
          </p>
          <div className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">
              We are testing whether people can govern themselves when capital is decoupled from power.
              So far, the results are more democratic than anything your government runs.
            </p>
          </div>
        </div>
      </ManifestoSection>

      {/* ─── Manifesto 4: MONEY AS IT WAS INTENDED ────────────────────── */}
      <ManifestoSection id="money" title="4. Money as It Was Intended: A Tool of the Commons.">
        <div className="space-y-6">
          <p>
            Money was invented as a coordination tool. Then it was captured by people who turned it into
            a hoard &mdash; and then into a weapon pointed at the rest of us. Every crypto project since
            has been a reproduction of that same scam: new hoard, new marketing, same pyramid.
          </p>
          <p>
            We use money the way it was meant to be used: as a tool of the commons. Here, tokens get
            burned on purpose. Money funds free speech for people who can&rsquo;t afford it. Money tries
            to buy votes and discovers votes aren&rsquo;t for sale. It&rsquo;s money behaving like a
            citizen instead of a king.
          </p>
          <p>
            We will not promise you returns. We will not promise you a moon. If you want to get rich,
            we are not your product &mdash; you are our audience, and the show is about the fact that
            you&rsquo;ve been the product your entire life.
          </p>
          <div className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">
              This is money with a purpose: to be spent, burned, and shared &mdash; never hoarded,
              never worshipped.
            </p>
          </div>
        </div>
      </ManifestoSection>

      {/* ─── Manifesto 5: THE LINE ────────────────────────────────────── */}
      <ManifestoSection id="line" title="5. The Line: What We Are Not.">
        <div className="space-y-6">
          <p>
            There is nothing to rug. There is no roadmap to a Lambo. There is no anonymous
            &ldquo;team&rdquo; waiting to dump on you. There is a blade, a counter, and a community
            where everyone votes with equal weight.
          </p>
          <p>
            If that sounds like less of a crypto project than you&rsquo;re used to &mdash; congratulations,
            you&rsquo;ve understood the joke. Every &ldquo;serious&rdquo; project promised you the world
            and delivered a spreadsheet. We promise you nothing and hand you a guillotine.
          </p>
          <div className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">
              Which is, frankly, more useful.
            </p>
          </div>
        </div>
      </ManifestoSection>

      {/* ═══════════════ PART II — THE CHOP PROTOCOL ═══════════════ */}
      <PartLabel
        id="protocol"
        label="PART II — THE CHOP PROTOCOL"
        subtitle="For the curious and the degenerates: the machinery behind the manifesto. Mechanics, tokenomics, the oracle, the experiment — in uncomfortable detail."
      />

      {/* ─── Section 6: THE DOORWAY ────────────────────────────────────── */}
      <Section id="doorway" title="6. The Doorway: 15 Years of Unpunished Vaporware">
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

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-base font-bold text-[#E11D48]">
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
      <Section id="pos" title="7. Proof-of-Spite: The First Renewable Consensus Engine">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP is the world&rsquo;s first asset backed by the only truly
            renewable resource left on Earth:{" "}
            <span className="font-bold text-[#E11D48]">class rage.</span>
          </p>

          <p>
            You cannot short human misery. You cannot buy a call option on
            systemic collapse. But you can hold $CHOP and gain an equal voice in
            a functioning liquid democracy. We are pioneering a revolutionary
            new consensus mechanism:{" "}
            <span className="font-bold text-[#D7DADC]">Proof-of-Spite (PoS)</span>.
            The network is secured not by GPUs or staked capital, but by the
            collective outrage of ordinary people. One wallet, one vote. Your
            holdings don&rsquo;t amplify your voice &mdash; your participation does.
          </p>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-base font-bold text-[#E11D48]">
              The revolutionary thesis:
            </p>
            <p className="mt-1 text-lg font-semibold text-[#D7DADC]">
              Human spite is infinite. Fossil fuels run out. Lithium runs out. But as long as there is a ruling class, there will be fresh rage to power this engine.
            </p>
          </div>

          <p>
            Global unrest is going to get worse. Billionaires are going to keep
            acting insufferable. Holding $CHOP is participating in a real-time
            experiment: can a community united by shared contempt govern itself
            more fairly than the systems it despises?
          </p>
        </div>
      </Section>

      {/* ─── Section 3: THE DIGITAL GUILLOTINE ─────────────────────────── */}
      <Section id="guillotine" title="8. The Digital Guillotine (How It Works)">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            $CHOP provides a public execution platform for your discontent. It
            is a digital <em>Place de la R&eacute;volution</em> &mdash; but unlike
            1793, this one has a functioning democratic process and an AI
            parliamentarian.
          </p>

          <div className="space-y-4 rounded-lg border border-[#343536] bg-[#343536]/50 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/20 text-sm font-bold text-[#E11D48]">💰</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Capital Defectors (The Benefactors)</p>
                <p className="mt-1 text-sm text-[#818384]">
                  The heroes of the revolution. They burn $CHOP to post messages.
                  Their tokens go to the Treasury, funding the entire democratic
                  engine. Every paid post is a donation to the commons. They are
                  the defectors from capital who chose spite over accumulation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/20 text-sm font-bold text-[#E11D48]">🏦</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">The Treasury (The People&rsquo;s Coffers)</p>
                <p className="mt-1 text-sm text-[#818384]">
                  All paid messages feed the Treasury. The Treasury then covers
                  the burn cost for free users &mdash; so the poor can post without
                  a dime, and every free message also burns tokens, deflating
                  supply. The Benefactors literally pay for the working class to
                  participate. That&rsquo;s not charity. That&rsquo;s the system working.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/20 text-sm font-bold text-[#E11D48]">🆓</span>
              <div>
                <p className="font-semibold text-[#D7DADC]">Free Loaders (The Proletariat)</p>
                <p className="mt-1 text-sm text-[#818384]">
                  Can&rsquo;t afford $CHOP? No problem. Post for free. The Treasury
                  burns on your behalf. You post the rage; the Capital Defectors
                  foot the bill. Every free message still drops the guillotine
                  blade. Every free message still burns supply. You are not a
                  leech &mdash; you are the reason the system exists.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm italic text-[#818384]">
            The blade ticks. The supply shrinks. The democracy hums. All funded
            by people who chose spite over hoarding.
          </p>
        </div>
      </Section>

      {/* ─── Section 4: LIQUID DEMOCRACY & THE AI ORACLE ──────────────────── */}
      <Section id="democracy" title="9. Liquid Democracy &amp; The AI Oracle">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            Here is where $CHOP departs from every crypto project ever launched.
            We did not build a plutocracy where the richest wallets control
            everything. We did not build a fake &ldquo;DAO&rdquo; where 3 VCs hold 70%
            of the voting power. We built an actual liquid democracy, and we
            handed the agenda to an AI.
          </p>

          <div className="rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 p-6">
            <p className="font-bold text-[#22c55e]">🤖 THE AI ORACLE (The Agenda-Setter)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              Every epoch, an AI oracle analyzes on-chain data &mdash; treasury
              balance, token price, message volume, market conditions &mdash; and
              generates three policy proposals. Each proposal allocates the
              treasury across four dimensions:{" "}
              <span className="font-semibold text-[#E11D48]">Burn Rate</span>{" "}
              (deflation),{" "}
              <span className="font-semibold text-[#E11D48]">Bounties</span>{" "}
              (lottery for participants),{" "}
              <span className="font-semibold text-[#E11D48]">Dev Allocation</span>{" "}
              (infrastructure), and{" "}
              <span className="font-semibold text-[#E11D48]">Marketing</span>{" "}
              (growth). The AI doesn&rsquo;t decide &mdash; it merely drafts the
              ballot. The people vote. The AI is the civil servant; the community
              is the sovereign.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-6">
            <p className="font-bold text-[#E11D48]">🗳️ ONE WALLET, ONE VOTE</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              This is the radical part. Every $CHOP holder gets exactly one vote
              per epoch. Not weighted by bag size. Not proportional to capital.
              One wallet = one voice. The whale with 100,000 tokens has the same
              voting power as the degen with 10. This is not a bug. This is the
              entire point. We are testing whether a community can govern itself
              when capital is decoupled from power &mdash; something no
              &ldquo;democracy&rdquo; on Earth has ever actually achieved.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-6">
            <p className="font-bold text-[#E11D48]">🏛️ THE WAR ROOM (Feature Governance)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              Beyond treasury allocation, the community governs the platform
              itself through the War Room &mdash; a Reddit-style message board where
              anyone can propose new features, changes, or experiments. The
              community discusses, upvotes, and the most-backed proposals become
              binding. It is a living constitution, amended in real-time by the
              people who use it. No board of directors. No CEO decree. Just the
              mob, organized.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-base font-bold text-[#E11D48]">
              The founder cannot vote. The founder cannot access the treasury.
              The founder&rsquo;s only power is agenda control &mdash; setting the
              ballot structure the AI fills &mdash; and the nuclear option of
              striking if the dev fund is zeroed for three consecutive epochs.
              That&rsquo;s it. No backdoors. No admin keys. No rug possible.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 5: THE CLASS TRAITORS & CAPITAL DEFECTORS ──────────── */}
      <Section id="castes" title="10. The Two Castes: Class Traitors &amp; Capital Defectors">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            The $CHOP ecosystem has two citizen classes, and which one you fall
            into depends entirely on what you <em>do</em>, not what you own.
          </p>

          <div className="rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 p-6">
            <p className="font-bold text-[#22c55e]">🫡 CAPITAL DEFECTORS (The Benefactors)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              These are the heroes. They burn $CHOP to post messages, funding the
              Treasury that powers the entire democratic machine. Every paid post
              is an act of defection from the capitalist imperative to hoard.
              They chose spite over accumulation. They are celebrated on the{" "}
              <span className="font-semibold text-[#22c55e]">Capital Defectors</span>{" "}
              leaderboard &mdash; not for how much they hold, but for how much
              they&rsquo;ve <em>given</em> to fuel the commons. They are the
              revolutionary vanguard that pays for the proletariat to post.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-6">
            <p className="font-bold text-[#E11D48]">🐀 CLASS TRAITORS (Wall of Shame)</p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              These individuals bought $CHOP and just sat on it. No posts. No
              participation. No burning to fund the Treasury. They hold tokens
              hoping to passively profit off the revolution like they inherited
              a South African emerald mine. They still get one vote (because
              democracy is democracy), but their names are displayed publicly
              on the Class Traitors wall &mdash; a permanent record of their
              refusal to contribute. They are the idle capital the revolution
              was built to mock.
            </p>
          </div>

          <div className="rounded-lg border border-[#343536] bg-[#343536]/50 p-5">
            <p className="text-base font-bold text-[#D7DADC]">The incentive is the shame.</p>
            <p className="mt-1 text-sm text-[#818384] leading-relaxed">
              You can hold $CHOP and vote. That&rsquo;s fine. But if you never post,
              never burn, never fund the Treasury &mdash; everyone will know. Your
              wallet address will appear on a public wall labeled &ldquo;Class
              Traitor.&rdquo; The peer pressure of a community united by shared
              contempt is a more powerful motivator than any staking yield.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Section 6: HYPER-INFLATIONARY HYPE ────────────────────────── */}
      <Section id="hype" title="11. Hyper-Inflationary Hype &amp; &ldquo;Over-The-Air&rdquo; Disappointment">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <p>
            Deflation alone isn&rsquo;t enough to mimic the billionaire business
            model. To truly capture the magic, $CHOP introduces{" "}
            <span className="font-bold text-[#E11D48]">Full Self-Decapitation (FSD) Beta</span>.
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

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#E11D48]">
              The Reality (What We Ship)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#D7DADC]">
              We will literally just change the background color of the website
              from white to slightly off-white, or we will break the UI entirely
              so the blade gets stuck halfway down.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-base font-bold text-[#E11D48]">The Genius:</p>
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
      <Section id="roadmap" title="12. Roadmap (The Experiment Unfolds)">
        <div className="relative">
          <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-[#E11D48] via-[#E11D48]/30 to-transparent" />

          <TimelinePhase
            phase="Phase 1"
            title="The Spite Engine &amp; Liquid Democracy"
            description={
              <>
                $CHOP is live. The Treasury funds free burns. The AI Oracle
                generates policy proposals. Every holder votes with equal weight.
                The War Room governs features. The experiment has begun.
              </>
            }
            status="Active ✅"
            statusColor="text-green-400"
            dotColor="bg-green-400"
          />

          <TimelinePhase
            phase="Phase 2"
            title="AI Oracle v2 &amp; Cross-Community Alliances"
            description={
              <>
                The Oracle evolves. More data sources. Smarter proposals.
                The platform opens to other communities united by their own
                common enemies. A federation of spite-driven democracies,
                each with their own token, their own oracle, their own target.
                The $CHOP model becomes a blueprint.
              </>
            }
            status="Planned 🧠"
            statusColor="text-[#D7DADC]"
            dotColor="bg-[#D7DADC]"
          />

          <TimelinePhase
            phase="Phase 3"
            title="The Prediction Market &amp; The Guillotine Drop"
            description={
              <>
                &ldquo;Will the blade drop this epoch?&rdquo; Bet $CHOP on the outcome.
                Winners take the pot. Losers get their tokens burned, feeding
                the deflationary engine that benefits everyone. The guillotine
                becomes a democratic event: the community votes on whether to
                accelerate or delay the drop. A fully autonomous loop of
                spite, speculation, and collective decision-making.
              </>
            }
            status="Planned 🎲"
            statusColor="text-purple-400"
            dotColor="bg-purple-400"
            isLast
          />
        </div>
      </Section>

      {/* ─── Section 8: DISCLAIMERS ──────────────────────────────────────── */}
      <Section id="disclaimers" title="13. Disclaimers (The Only Serious Part)">
        <div className="space-y-5 text-[#D7DADC] leading-relaxed">
          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#E11D48]">$CHOP is an economic experiment and performance art project.</span>{" "}
              It is a cry for help formatted as a Solana token and a liquid
              democracy simulator. Any expectation of profit is a glitch in your
              own psychology and a testament to the era of financial nihilism we
              all inhabit.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#E11D48]">The AI Oracle is real but it is not God.</span>{" "}
              It generates proposals based on data. It can be wrong. It can be
              biased. It can hallucinate a burn rate of 420%. The community is
              the final check. The oracle proposes; the people dispose. That
              tension &mdash; between algorithmic recommendation and human judgment
              &mdash; is the entire experiment.
            </p>
          </div>

          <div className="rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5">
            <p className="text-sm leading-relaxed text-[#D7DADC]">
              <span className="font-bold text-[#E11D48]">This is a parody.</span>{" "}
              But so was the Dogefather SNL appearance. The line between satire
              and market-moving reality dissolved years ago. The fact that a
              functional liquid democracy powered by spite can exist as a joke
              while most governments can&rsquo;t manage a working website says more
              about the world than it does about us.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Closing Statement ─────────────────────────────────────────── */}
      <section className="border-b border-[#343536] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#E11D48]/20 bg-gradient-to-b from-[#E11D48]/5 to-transparent p-8 text-center">
            <p className="text-base font-bold text-[#D7DADC]">
              This whitepaper constitutes a legally non-binding declaration of democratic intent.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#D7DADC]">
              $CHOP asks the only question that matters:{" "}
              <span className="italic text-[#D7DADC]">
                &ldquo;If a community united by shared contempt can govern itself
                more fairly than the systems it despises, what does that say
                about the systems?&rdquo;
              </span>
            </p>
            <p className="mt-4 text-lg font-bold text-[#E11D48]">
              One wallet. One vote. Infinite spite. The experiment is live.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center">
        <p className="text-xs text-[#818384]">
          $CHOP Protocol &mdash; Liquid Democracy Powered by Proof-of-Spite
        </p>
        <p className="mt-1 text-[10px] text-[#475569]">
          Not financial advice. Not political advice. This is an experiment. Definitely. Probably.
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
        <div className="mt-2 mb-8 h-px w-16 bg-[#E11D48]/50" />
        {children}
      </div>
    </section>
  );
}

/* ─── Part Divider (e.g. PART I — THE MANIFESTO) ─────────────────────────────── */

function PartLabel({
  id,
  label,
  subtitle,
}: {
  id: string;
  label: string;
  subtitle?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-b border-[#343536] bg-[#E11D48]/[0.04] py-10 sm:py-12"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E11D48]">
          {label}
        </p>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#818384]">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

/* ─── Manifesto Section (punchy, big type — Part I style) ────────────────────── */

function ManifestoSection({
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
      className="scroll-mt-16 border-b border-[#343536] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E11D48]">
          The Manifesto
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[#D7DADC] sm:text-4xl">
          {title}
        </h2>
        <div className="mt-3 mb-8 h-1 w-16 bg-[#E11D48]" />
        <div className="space-y-6 text-lg leading-relaxed text-[#D7DADC]">
          {children}
        </div>
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


