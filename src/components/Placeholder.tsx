export default function Placeholder({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm text-slate-500">준비 중인 기능</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
