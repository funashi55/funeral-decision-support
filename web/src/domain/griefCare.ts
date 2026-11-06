/**
 * 遺族への配慮（グリーフケア）の考え方。死別の研究で知られた理論を、打合せの場で使える形に直して固定で持つ。
 * モデルは「この会話でどれが当てはまり、どう言うとよいか」だけを選んで書き、理論の説明・出典・避けたい言葉はここから出す。
 *
 * 前提：
 * - 担当者は心理の専門家ではない。ここにあるのは打合せでの配慮であって、治療や診断ではない
 * - 悲しみ方に決まった順番はない（段階説を当てはめない）
 * - 気持ちへの配慮を、有料の選択肢を勧める理由にしない
 */

export type GriefPrincipleId =
  | "oscillation"
  | "continuing_bonds"
  | "meaning"
  | "reality"
  | "guilt"
  | "no_stages"
  | "companioning"
  | "anticipatory"
  | "sudden"
  | "unrecognized";

export interface GriefPrinciple {
  readonly id: GriefPrincipleId;
  /** 担当者に見せる短い名前 */
  readonly name: string;
  /** 打合せでの考え方（一文） */
  readonly principle: string;
  /** どんな発言・様子のときに当てはまるか */
  readonly signals: string;
  /** かける言葉の例（固定。モデルが場面に合わせた言い方を別に書く） */
  readonly sayExamples: readonly string[];
  /** 避けたい言葉と、その理由 */
  readonly avoid: readonly { readonly words: string; readonly why: string }[];
  /** 拠りどころにした理論 */
  readonly theory: string;
  readonly source: string;
}

export const GRIEF_PRINCIPLES: readonly GriefPrinciple[] = [
  {
    id: "oscillation",
    name: "悲しむ時間と、進める時間を行き来してよい",
    principle: "悲しみに向き合う時間と、手続きや段取りを進める時間を行き来するのは自然なこと。どちらかに偏らせない。",
    signals: "涙ぐむ・言葉に詰まる・話が途切れる。あるいは淡々と段取りを進めようとする",
    sayExamples: ["少しお休みしてから続けましょうか", "今日決めなくてよいものは、あとに回しましょう"],
    avoid: [
      { words: "早く決めてしまいましょう", why: "悲しむ時間を取り上げる" },
      { words: "しっかりしてください", why: "段取りを進める側だけを求める" },
    ],
    theory: "二重過程モデル（喪失への対処と、生活の立て直しへの対処を揺れ動く）",
    source: "Stroebe & Schut (1999) The Dual Process Model of Coping with Bereavement. Death Studies, 23(3)",
  },
  {
    id: "continuing_bonds",
    name: "故人とのつながりは続いてよい",
    principle: "亡くなったあとも、故人との関係は形を変えて続く。故人の話をしてもらい、好きだったものや人柄をお別れに生かす。",
    signals: "故人の好きだったもの・口ぐせ・習慣を話す。写真や愛用の品に触れる",
    sayExamples: ["お母さまは、どんな方でしたか", "お好きだったものを、お棺に入れて差し上げることもできます"],
    avoid: [
      { words: "早く忘れて、前を向きましょう", why: "つながりを断つよう求める" },
      { words: "もう過ぎたことですから", why: "故人の話を打ち切る" },
    ],
    theory: "継続する絆（故人との絆を断つのではなく、形を変えて保つ）",
    source: "Klass, Silverman & Nickman (Eds.) (1996) Continuing Bonds: New Understandings of Grief. Taylor & Francis",
  },
  {
    id: "meaning",
    name: "意味はご家族が見つける",
    principle: "死の意味や故人の人生の意味は、語るなかでご家族自身が見つけていく。担当者は言葉を返して、語る場をつくる。",
    signals: "故人の人生や最期の様子を語る。「なぜ」「どうして」と口にする",
    sayExamples: ["「〇〇」とおっしゃっていましたね（ご家族の言葉をそのまま返す）", "よろしければ、もう少し聞かせてください"],
    avoid: [
      { words: "寿命でしたね／大往生ですね", why: "死の意味を他人が決めてしまう" },
      { words: "天国で喜んでいますよ", why: "信仰や受け止めを押しつけうる" },
    ],
    theory: "意味の再構成（喪失の意味を、語りを通じて組み立て直す）",
    source: "Neimeyer (Ed.) (2001) Meaning Reconstruction and the Experience of Loss. American Psychological Association",
  },
  {
    id: "reality",
    name: "お別れの実感は、ご家族の歩幅で",
    principle: "お顔を見る・触れる・身支度に加わることは、亡くなった実感を持つ助けになることがある。ただし、望まない人に勧めない。",
    signals: "「まだ信じられない」「実感がない」と口にする。お顔を見るか迷っている",
    sayExamples: ["お顔を見ていただくこともできます。ご無理はなさらなくて大丈夫です", "手を添えていただくこともできますし、見守っていただくだけでも構いません"],
    avoid: [
      { words: "会っておかないと後悔しますよ", why: "後悔を先回りして、決断を迫る" },
      { words: "皆さん触れてあげています", why: "多数派に合わせるよう促す" },
    ],
    theory: "悲嘆の課題のうち「喪失の現実を受け入れる」（課題は順番に進む段階ではない）",
    source: "Worden (2018) Grief Counseling and Grief Therapy, 5th ed. Springer",
  },
  {
    id: "guilt",
    name: "罪悪感は、正さずに受け止める",
    principle: "「何もしてあげられなかった」という言葉は、すぐに否定も同意もせず、まず受け止める。後悔を選択肢の理由にしない。",
    signals: "「もっと早く気づいていれば」「何もしてあげられなかった」と口にする",
    sayExamples: ["そう感じていらっしゃるのですね", "ずっとそばで見てこられたのですね"],
    avoid: [
      { words: "仕方なかったですよ", why: "気持ちを早く片づけようとしてしまう" },
      { words: "せめて最後くらいは〇〇を", why: "罪悪感を有料の選択肢につなげる" },
    ],
    theory: "死別後の罪悪感の研究（罪悪感は悲嘆の一部としてよく見られ、否定よりも受容的な傾聴が勧められる）",
    source: "Li, Stroebe, Chan & Chow (2014) Guilt in bereavement: A review and conceptual framework. Death Studies, 38(3)",
  },
  {
    id: "no_stages",
    name: "悲しみ方に正しい順番はない",
    principle: "怒る・泣かない・笑う・事務的になる、どれも自然な反応。段階に当てはめて評価しない。",
    signals: "泣かない家族、冗談を言う家族、怒りを口にする家族、家族の間で反応が違う",
    sayExamples: ["お気持ちは、人それぞれで当然です", "（評価せず、そのまま話を聞く）"],
    avoid: [
      { words: "まだ受け入れられていないんですね", why: "段階に当てはめて評価する" },
      { words: "そのうち落ち着きますよ", why: "悲しみに期限や筋道を当てる" },
    ],
    theory: "段階説への注意喚起（死にゆく人の段階説を遺族に当てはめる根拠は乏しい）",
    source: "Stroebe, Schut & Boerner (2017) Cautioning health-care professionals: Bereaved persons are misguided through the stages of grief. OMEGA, 74(4)",
  },
  {
    id: "companioning",
    name: "治そうとせず、そばにいる",
    principle: "励ましたり答えを出したりするより、そばで聞くことを優先する。沈黙を急いで埋めない。",
    signals: "沈黙が続く。思い出を語り始める。担当者が励ましの言葉を探しそうな場面",
    sayExamples: ["（沈黙を待つ）", "急がなくて大丈夫です。ゆっくりで構いません"],
    avoid: [
      { words: "頑張ってください／元気を出して", why: "悲しみを早く終わらせるよう求める" },
      { words: "お気持ちはよくわかります", why: "相手の体験を自分のものとして扱ってしまう" },
    ],
    theory: "寄り添いのモデル（遺族を治療の対象ではなく、ともに歩む相手として見る）",
    source: "Wolfelt (2006) Companioning the Bereaved: A Soulful Guide for Caregivers. Companion Press",
  },
  {
    id: "anticipatory",
    name: "長い看病のあとの安堵も、自然な気持ち",
    principle: "看病や介護が長かった家族には、悲しみと安堵が混ざる。安堵した自分を責めることもあるので、ねぎらう。",
    signals: "長い入院・介護・看病の話。「やっと楽になれた」「ほっとした」と口にする",
    sayExamples: ["長い間、本当にお疲れさまでした", "ずっと支えてこられたのですね"],
    avoid: [
      { words: "楽になってよかったですね", why: "家族の受け止めを決めつける" },
      { words: "覚悟はできていたでしょうから", why: "悲しみを小さく見積もる" },
    ],
    theory: "予期悲嘆（亡くなる前から始まっている悲嘆）",
    source: "Rando (Ed.) (1986) Loss and Anticipatory Grief. Lexington Books",
  },
  {
    id: "sudden",
    name: "突然の別れでは、決めることを小さく分ける",
    principle: "突然の死のあとは、現実感がなく判断が難しいことが多い。一度に多くを決めさせず、同じ説明を繰り返し、書いて渡す。",
    signals: "急な死・事故・予期しない亡くなり方。同じことを何度も尋ねる、話が頭に入らない様子",
    sayExamples: ["今日決めるのは、この二つだけで大丈夫です", "あとで見返せるように、紙にも書いてお渡しします"],
    avoid: [
      { words: "さきほどもお伝えしましたが", why: "混乱している人を責める" },
      { words: "全部今日決めましょう", why: "判断の負担を一度に負わせる" },
    ],
    theory: "突然の死による悲嘆（予期しない死では衝撃が大きく、情報を受け止める力が落ちる）",
    source: "Stroebe, Schut & Stroebe (2007) Health outcomes of bereavement. The Lancet, 370(9603)",
  },
  {
    id: "unrecognized",
    name: "喪主以外の悲しみにも目を向ける",
    principle: "孫・きょうだい・友人・遠方の家族など、周りから悲しみを認められにくい人がいる。その人のお別れの機会にも目を向ける。",
    signals: "喪主以外の人の名前が出る。遠方の家族、孫、親しかった友人、内縁の人の話",
    sayExamples: ["〇〇さんも、お別れの時間をとりたいと思われていそうですか", "お顔を見ていただきたい方は、ほかにいらっしゃいますか"],
    avoid: [
      { words: "ご家族だけで済ませましょう", why: "悲しむ人を外してしまう" },
      { words: "（喪主にだけ話しかけ続ける）", why: "ほかの人の悲しみを見えなくする" },
    ],
    theory: "公認されない悲嘆（社会から悲しむ権利を認められにくい喪失）",
    source: "Doka (Ed.) (1989) Disenfranchised Grief: Recognizing Hidden Sorrow. Lexington Books",
  },
];

export const GRIEF_PRINCIPLE_IDS = GRIEF_PRINCIPLES.map((p) => p.id) as [GriefPrincipleId, ...GriefPrincipleId[]];

export function getGriefPrinciple(id: string): GriefPrinciple {
  const p = GRIEF_PRINCIPLES.find((x) => x.id === id);
  if (!p) throw new Error(`未定義の配慮の考え方です: ${id}`);
  return p;
}
