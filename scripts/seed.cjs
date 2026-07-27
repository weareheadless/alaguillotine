const { Client, Databases, ID } = require("appwrite");
const fs = require("fs");

// Parse .env.local
const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const client = new Client()
  .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
if (env.APPWRITE_API_KEY) client.setDevKey(env.APPWRITE_API_KEY);

const db = new Databases(client);
const DB_ID = "6a66718b002cb69a289a";
const COL_ID = "messages";

const messages = [
  { text: "Elon Musk is the greatest con artist of our generation", author_name: "CryptoCynic", amount_paid: 0 },
  { text: "Remember when he said FSD would be ready in 2016? I member.", author_name: "TSLABear", amount_paid: 0 },
  { text: "Just YOLOd my rent money into $DOGE because Elon tweeted a meme. No regrets.", author_name: "DegenerateDan", amount_paid: 50 },
  { text: "The cybertruck looks like something I drew in 3rd grade", author_name: "DesignSnob42", amount_paid: 0 },
  { text: "He literally bought Twitter just to make it worse. That takes talent.", author_name: "ExTwitterRefugee", amount_paid: 25 },
  { text: "fElon - noun. A person who overpromises and underdelivers while taking credit for others' work.", author_name: "DictionaryDan", amount_paid: 0 },
  { text: "My Tesla has been in the shop for 6 months waiting for a door handle", author_name: "TeslaVictim", amount_paid: 0 },
  { text: "FULL SELF DRIVING COMING NEXT YEAR — Elon, every year since 2014", author_name: "TimeTraveler2026", amount_paid: 100 },
  { text: "The boring company is just him digging a hole in his backyard", author_name: "CivilEngineer007", amount_paid: 0 },
  { text: "I'd rather walk than drive a cybertruck. And I'm paralyzed.", author_name: "WheelchairWarrior", amount_paid: 75 },
  { text: "Neuralink? More like NeuralStink amirite", author_name: "DadJokeDev", amount_paid: 0 },
  { text: "Elon simps are a different breed. The man could set them on fire and they'd thank him.", author_name: "PsychologyMajor", amount_paid: 0 },
  { text: "SpaceX is cool. Too bad its founder is insufferable.", author_name: "RocketFan99", amount_paid: 0 },
  { text: "He named his kid X Æ A-12 and expected us to take him seriously", author_name: "NamingExpert", amount_paid: 30 },
  { text: "Hyperloop was just a scheme to kill California high speed rail. Look it up.", author_name: "TrainEnjoyer", amount_paid: 0 },
  { text: "Elon's hair transplant is working overtime", author_name: "FollicleDetective", amount_paid: 0 },
  { text: "If I had a dollar for every broken Tesla promise I'd have enough to buy Twitter", author_name: "MathWizard", amount_paid: 0 },
  { text: "The sheer audacity of this man to call himself a 'free speech absolutist' while banning journalists", author_name: "PressFreedomNow", amount_paid: 45 },
  { text: "Elon Musk 🤝 Overpromising 🤝 Underdelivering — name a more iconic trio", author_name: "MemeEconomist", amount_paid: 0 },
  { text: "My grandma could build a better truck with her knitting needles", author_name: "GrandmasBoy", amount_paid: 0 },
  { text: "Fuck you Elon, sincerely — an actual rocket scientist you stole credit from", author_name: "RealRocketScientist", amount_paid: 200 },
  { text: "He's not Iron Man, he's the guy who bought Iron Man's company and called himself the inventor", author_name: "MarvelNerd", amount_paid: 0 },
  { text: "I named my Roomba 'Elon' because it bumps into walls and never finishes the job", author_name: "SmartHomeGuy", amount_paid: 15 },
  { text: "The man faked a robot demo. Let that sink in.", author_name: "RoboticsPhD", amount_paid: 0 },
  { text: "$44 billion to make a website worse. Incredible ROI.", author_name: "VentureCapitalLOL", amount_paid: 0 },
  { text: "Elon simping for dictators is not the plot twist I expected", author_name: "Geopolitics101", amount_paid: 0 },
  { text: "🚀💎 TO THE MOON — just kidding your portfolio is gone", author_name: "CryptoGhost", amount_paid: 80 },
  { text: "Every Elon tweet is a legal liability and I'm here for it", author_name: "LawyerCat", amount_paid: 0 },
  { text: "The only thing he's disrupted is my faith in humanity", author_name: "DisillusionedMillennial", amount_paid: 0 },
  { text: "I asked ChatGPT to roast Elon and it crashed from laughing too hard", author_name: "AIBeliever", amount_paid: 10 },
];

(async () => {
  console.log(`Seeding ${messages.length} messages...`);
  let count = 0;
  for (const msg of messages) {
    try {
      const ts = new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString();
      await db.createDocument(DB_ID, COL_ID, ID.unique(), {
        text: msg.text,
        author_name: msg.author_name,
        author_id: null,
        amount_paid: msg.amount_paid,
        is_shadowbanned: false,
        created_at: ts,
      });
      count++;
    } catch (e) {
      console.error(`  Failed: ${msg.text.substring(0, 40)}... - ${e.message}`);
    }
  }
  console.log(`Done! Inserted ${count}/${messages.length} messages.`);
})();
