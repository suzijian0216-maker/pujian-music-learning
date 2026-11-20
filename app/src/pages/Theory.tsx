import { useRef, useState } from 'react';
import { findTheory, THEORY, THEORY_CATEGORIES, type TheoryEntry } from '../data/theory';

export function Theory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [selected, setSelected] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const results = findTheory(query, category);
  const entry = THEORY.find((item) => item.id === selected) ?? results[0];

  function open(item: TheoryEntry) {
    setSelected(item.id);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  }

  return <>
    <div className="topline"><div><h1>乐理大全</h1><div className="sub">从看懂一个符号，到理解一段音乐 · 内置基础与进阶入门知识</div></div><span className="pill">{THEORY.length} 个词条 · 离线可查</span></div>
    <section className="card theory-search">
      <label htmlFor="theory-query">想了解什么？</label>
      <div className="search-row"><input id="theory-query" type="search" placeholder="搜索音程、6/8、揉弦、crescendo…" value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }} /><button className="btn btn-ghost" onClick={() => { setQuery(''); setCategory('全部'); setSelected(null); }}>重置</button></div>
      <div className="hint">支持中文、英文术语和正文关键词；多个关键词用空格分隔。搜索范围为内置词条。</div>
      <div className="theory-filters" aria-label="乐理分类">{['全部', ...THEORY_CATEGORIES].map((item) => <button key={item} aria-pressed={category === item} className={category === item ? 'on' : ''} onClick={() => { setCategory(item); setSelected(null); }}>{item}</button>)}</div>
      <div className="row"><span className="sub">试试</span>{['纯五度', '附点', '音色', '6/8'].map((word) => <button className="theory-link" key={word} onClick={() => { setQuery(word); setCategory('全部'); setSelected(null); }}>{word}</button>)}</div>
    </section>
    <p className="sub" role="status">找到 {results.length} 个词条{category !== '全部' ? ` · ${category}` : ''}</p>
    {results.length === 0 ? <div className="card empty">没有找到匹配词条。可缩短关键词、尝试常见术语，或点击「重置」查看全部。</div> : <div className="theory-layout">
      <div className="theory-results" aria-label="词条列表">{results.map((item) => <button key={item.id} className={`card theory-result ${entry?.id === item.id ? 'selected' : ''}`} aria-pressed={entry?.id === item.id} onClick={() => open(item)}><span className="sub">{item.category}</span><strong>{item.title}</strong><span>{item.summary}</span></button>)}</div>
      {entry && <article className="card theory-article" aria-labelledby="theory-title"><span className="pill">{entry.category}</span><h2 id="theory-title" tabIndex={-1} ref={heading}>{entry.title}</h2><p className="theory-lead">{entry.summary}</p><h3>详细解释</h3><p>{entry.explanation}</p><div className="theory-example"><h3>举个例子</h3><p>{entry.example}</p></div><h3>练习提醒</h3><p>{entry.tip}</p><h3>相关知识</h3><div className="row">{entry.related.map((id) => THEORY.find((item) => item.id === id)).filter((item): item is TheoryEntry => !!item).map((item) => <button className="btn btn-ghost btn-sm" key={item.id} onClick={() => { setQuery(''); setCategory('全部'); open(item); }}>{item.title} ↗</button>)}</div><p className="hint">自编学习笔记，以常见记谱与基础乐理为主；不同教材、风格的术语与演奏处理可能有所不同。</p></article>}
    </div>}
  </>;
}
