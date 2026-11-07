/**
 * The standing record.
 *
 * The queue cannot be built from today's feed alone: the people who bankroll
 * the machinery are not in the news every day, and a list that forgets them is
 * a list of whoever happened to be quoted this morning. These are documented,
 * long-running cases Ada is required to carry unless the evidence contradicts
 * them. She still sets the score; this is the memory, not the verdict.
 */
export const STANDING: Array<{ name: string; role: string; country: string; basis: string }> = [
  { name: "Elon Musk", role: "CEO, Tesla / SpaceX / xAI", country: "United States",
    basis: "Ran the Department of Government Efficiency, which dismantled USAID programmes; Starlink and federal contracts; largest disclosed political donor in the 2024 cycle; repeated far-right amplification on X." },
  { name: "Peter Thiel", role: "Co-founder, Palantir / Founders Fund", country: "United States",
    basis: "Palantir surveillance and targeting contracts with immigration enforcement and militaries; funded the political rise of JD Vance; defence and data infrastructure for allied militaries." },
  { name: "Alex Karp", role: "CEO, Palantir", country: "United States",
    basis: "Palantir supplies targeting, surveillance and deportation infrastructure to governments, including systems used in Gaza and in immigration enforcement." },
  { name: "Larry Ellison", role: "Co-founder, Oracle", country: "United States",
    basis: "Oracle provides cloud infrastructure for the Israeli government; major political donor; media ownership through the Ellison family." },
  { name: "Palmer Luckey", role: "Founder, Anduril", country: "United States",
    basis: "Anduril sells autonomous weapons and border surveillance systems to governments; lobbying and political spending on defence procurement." },
  { name: "David Sacks", role: "White House AI and crypto adviser", country: "United States",
    basis: "Crafted AI and crypto policy while holding venture positions in the affected industries." },
  { name: "Jared Kushner", role: "Former senior adviser; Affinity Partners", country: "United States",
    basis: "Affinity Partners raised billions from Gulf sovereign funds after government service; Middle East policy and Gaza reconstruction proposals." },
  { name: "Miriam Adelson", role: "Publisher, Las Vegas Review-Journal; donor", country: "United States",
    basis: "One of the largest political donors in the United States; ownership of a major newspaper; funding of settlement and annexation politics." },
  { name: "Stephen Miller", role: "Deputy chief of staff for policy", country: "United States",
    basis: "Architect of mass deportation and family separation policy; advocacy of denaturalisation and detention expansion." },
  { name: "Benjamin Netanyahu", role: "Prime Minister", country: "Israel",
    basis: "Head of government during the Gaza war; ICC arrest warrant; 125 incursions into Quneitra in October 2026." },
  { name: "Vladimir Putin", role: "President", country: "Russia",
    basis: "Ordered the full-scale invasion of Ukraine; ICC arrest warrant; strikes on aid infrastructure." },
  { name: "Mohammed bin Salman", role: "Crown Prince", country: "Saudi Arabia",
    basis: "Yemen campaign; Khashoggi killing; sovereign fund and media capture." },
  { name: "Mohamed Hamdan Dagalo (Hemedti)", role: "RSF commander", country: "Sudan",
    basis: "RSF atrocities in Darfur and El Fasher; arms supply chains through the UAE." },
  { name: "Abdel Fattah al-Burhan", role: "Head of state", country: "Sudan",
    basis: "Sudanese armed forces conduct of the war; famine conditions under siege." },
  { name: "Min Aung Hlaing", role: "Commander-in-chief", country: "Myanmar",
    basis: "Military coup; airstrikes on schools and hospitals; Rohingya persecution." },
];
