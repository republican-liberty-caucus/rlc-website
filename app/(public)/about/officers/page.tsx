import { Metadata } from 'next';
import Image from 'next/image';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Officers & Board',
  description:
    'Meet the officers and board members of the Republican Liberty Caucus.',
};

const officers = [
  {
    name: 'John Dennis',
    title: 'Chair',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/63a2d3bdd2454b4de826676e.jpeg',
    bio: 'John Dennis was born in Jersey City, N.J., and currently resides in San Francisco. He earned a bachelor\'s from Fordham University. Dennis is a real estate investor and CEO and founder of San Francisco-based Foundation Real Estate, which he started in 2001. A self-styled "Ron Paul Republican," Dennis supports legalizing marijuana, opposes foreign interventionism, and supports individual liberty. He calls for dramatically reducing federal spending and shrinking the government\'s role domestically and overseas. He advocates phasing out the income tax, repealing the Patriot Act, and auditing the Federal Reserve.',
  },
  {
    name: 'Ben Beckhart',
    title: 'Vice Chair',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/696d0a84b34b642ea6897731.jpg',
    bio: 'Ben Beckhart first got involved in politics as a Ron Paul supporter during the 2008 election cycle. He served as a Precinct Committeeman in the Arizona Republican Party for twelve years. In 2018, he co-founded the Republican Liberty Caucus of Arizona (RLCAZ), where he held the role of Secretary/Treasurer for four years before serving as Vice Chair for an additional year. After relocating to Kentucky, Ben helped launch the Republican Liberty Caucus of Kentucky (RLCKY) in 2025, currently serving as the RLCKY Chairman. He has been active on the national RLC board since 2021 and also chairs the RLC Legislative Affairs Committee, where he plays a key role in developing the organization\'s annual legislative scorecards.',
  },
  {
    name: 'Matt Nye',
    title: 'Treasurer & Immediate Past Chair',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/6845d9325d6a598a19d68c19.jpeg',
    bio: 'Matt Nye is an innovative entrepreneur and political activist with more than 30 years experience in finance and technology. Nye has served in every role possible within the Republican Liberty Caucus since becoming involved in 2007. He founded the Republican Liberty Caucus of Central East Florida (RLCCEF) in 2008, organized the Brevard Tea Parties in 2009, and was elected National Chair of the Republican Liberty Caucus in 2013, serving for a decade in that capacity. He now serves as Treasurer. Nye is a frequently sought expert on subjects like taxes, regulation, waste, fraud, abuse and transparency.',
  },
  {
    name: 'Michael Anderson',
    title: 'Secretary',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/696d0a8ed403b70faff0952b.jpeg',
    bio: 'Michael Anderson is a Christian and America First conservative with over eight years of experience in grassroots politics and legislative advocacy. He began his political involvement with Young Americans for Liberty, serving as Chapter President and Texas State Chair. He later launched YAL\'s legislative action program as Hazlitt Action Director, leading successful efforts to pass major conservative legislation including Texas Constitutional Carry and school choice legislation in Kentucky and Missouri. He currently serves as Secretary on the National Board and is Vice Chair of the Republican Liberty Caucus of Texas.',
  },
];

export default function OfficersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Officers & Board</h1>
          <p className="mt-4 text-xl text-white/90">
            National leadership of the Republican Liberty Caucus
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl space-y-12">
            {officers.map((officer) => (
              <div
                key={officer.name}
                className="flex flex-col items-center gap-8 rounded-lg border bg-card p-8 sm:flex-row sm:items-start"
              >
                <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={officer.image}
                    alt={officer.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{officer.name}</h2>
                  <p className="mt-1 text-lg font-medium text-rlc-red">
                    {officer.title}
                  </p>
                  <p className="mt-4 text-muted-foreground">{officer.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Republican Liberty Caucus &middot; 44 Summerfield St, Thousand Oaks,
            CA 91360 &middot; (866) 752-5423
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
