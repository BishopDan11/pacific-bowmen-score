/* Lightweight offline PDF scorecard writer. No external services or libraries. */
(() => {
  'use strict';
  const enc = new TextEncoder();
  const ascii = str => enc.encode(str.replace(/[^\x20-\x7e\n\r]/g, '?'));
  const merge = parts => { const n=parts.reduce((s,p)=>s+p.length,0), out=new Uint8Array(n); let pos=0; for(const p of parts){out.set(p,pos);pos+=p.length;} return out; };
  const escapePDF = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g, c=>'\\'+c);
  const fmt = n => String(n).padStart(2,'0');
  const colours = {navy:'0.10 0.13 0.43', gold:'0.95 0.79 0.18', pale:'0.95 0.96 0.99',grey:'0.43 0.48 0.56', white:'1 1 1'};
  function create({data,archer,logo,photo}) {
    const max = data.format === 'PB2' ? 800 : 400;
    const columns = data.format === 'ABA3' ? 3 : data.format === 'PB1' ? 1 : 2;
    const date = new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(data.shootDate));
    const title = data.shootType === 'Casual' ? 'Casual Shoot' : new Intl.DateTimeFormat('en-AU',{month:'long'}).format(new Date(data.shootDate))+' Club Shoot';
    const vals = code => ({A:20,B:18,C:16,M:0})[code] || 0;
    const arrowPoints = (v,i) => v === null ? 0 : data.format === 'ABA3' ? ({A:[20,14,8],B:[18,12,6],C:[16,10,4],M:[0,0,0]})[v][i] : vals(v);
    const skipped = (r,i) => data.format === 'ABA3' && r.slice(0,i).some(v=>v!==null && v!=='M');
    const commands=[];
    const raw = x => commands.push(x);
    const rect = (x,y,w,h,c) => raw(`${colours[c]||c} rg ${x} ${y} ${w} ${h} re f\n`);
    const line = (x1,y1,x2,y2) => raw(`0.86 0.88 0.93 RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S\n`);
    const text = (x,y,msg,size=10,bold=false,color='navy') => raw(`BT /${bold?'F2':'F1'} ${size} Tf ${colours[color]||color} rg 1 0 0 1 ${x} ${y} Tm (${escapePDF(msg)}) Tj ET\n`);
    const imageCmd = (key,x,y,w,h) => raw(`q ${w} 0 0 ${h} ${x} ${y} cm /${key} Do Q\n`);
    rect(0,0,595,842,'white');
    rect(0,742,595,100,'navy'); rect(0,737,595,5,'gold');
    if(logo) imageCmd('Logo',35,752,70,70);
    text(logo?120:39,797,'PACIFIC BOWMEN',20,true,'white');
    text(logo?120:39,773,'INDIVIDUAL ARCHERY SCORECARD',11,false,'white');
    text(40,709,title,17,true);
    text(40,687,`${date}   |   ${data.format==='PB1'?'1-arrow Pacific Bowmen':data.format==='PB2'?'2-arrow Pacific Bowmen':'3-arrow ABA'}   |   20 targets`,10,false,'grey');
    if(photo) imageCmd('Photo',490,659,66,66);
    text(40,646,'ARCHER',8,true,'grey'); text(40,623,archer.name.slice(0,48),18,true);
    const score = archer.rounds.reduce((sum,r)=>sum+r.reduce((n,v,i)=>n+arrowPoints(v,i),0),0);
    text(365,648,'FINAL SCORE',8,true,'grey'); text(365,620,`${score} / ${max}`,23,true);
    rect(39,577,517,28,'navy');
    const xs = columns === 1 ? [156] : columns===2 ? [156,301] : [145,260,375];
    text(49,586,'TARGET',9,true,'white');
    for(let i=0;i<columns;i++) text(xs[i],586,`ARROW ${i+1} / RUNNING`,8,true,'white');
    const sums=Array(columns).fill(0);
    for(let t=0;t<20;t++){
      const r=archer.rounds[t];
      const y=557-t*21;
      if(t%2===0) rect(39,y-5,517,21,'pale');
      text(49,y+2,fmt(t+1),9,true);
      for(let a=0;a<columns;a++){
        const v=r[a];
        const skippedArrow=skipped(r,a);
        const value=skippedArrow?0:arrowPoints(v,a);
        sums[a]+=value;
        const mark=skippedArrow?'--':v===null?'--':v==='M'?'Miss':v;
        const label=skippedArrow?'Not shot':v===null?'--':`${mark} (${value})`;
        text(xs[a],y+2,`${label}    ${sums[a]}`,9, false, v==='M'?'grey':'navy');
      }
      line(39,y-5,556,y-5);
    }
    rect(39,102,517,32,'pale');
    text(49,113,'ARROW TOTALS',9,true);
    for(let i=0;i<columns;i++) text(xs[i],113,String(sums[i]),12,true);
    text(40,76,`GRAND TOTAL: ${score} / ${max}`,17,true);
    text(40,52,'Pacific Bowmen  |  20-target round  |  Scores recorded by the club scorecard app',8,false,'grey');
    text(489,52,'Page 1 of 1',8,false,'grey');

    const content=ascii(commands.join(''));
    // Each PDF object is assembled as bytes to preserve JPEG binary streams.
    const objects=[];
    const push = bytes => { objects.push(typeof bytes==='string'?ascii(bytes):bytes); return objects.length; };
    const catalog=push('<< /Type /Catalog /Pages 2 0 R >>');
    const pages=push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    const page=push('');
    const font1=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const font2=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const streamObj=push(merge([ascii(`<< /Length ${content.length} >>\nstream\n`),content,ascii('\nendstream')]));
    const images=[];
    for(const [key,jpeg] of [['Logo',logo],['Photo',photo]]) {
      if (!jpeg) continue;
      const id=push(merge([ascii(`<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`),jpeg.bytes,ascii('\nendstream')]));
      images.push(`/${key} ${id} 0 R`);
    }
    objects[page-1]=ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << ${images.join(' ')} >> >> /Contents ${streamObj} 0 R >>`);
    const chunks=[ascii('%PDF-1.4\n%Pacific Bowmen\n')];
    let offset=chunks[0].length;
    const offsets=[0];
    for(let i=0;i<objects.length;i++){
      offsets.push(offset);
      const obj=merge([ascii(`${i+1} 0 obj\n`),objects[i],ascii('\nendobj\n')]); chunks.push(obj);offset+=obj.length;
    }
    const xref=offset;
    const table=[`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`];
    for(let i=1;i<offsets.length;i++) table.push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    table.push(`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);
    chunks.push(ascii(table.join('')));
    return new Blob(chunks,{type:'application/pdf'});
  }
  function dimensions(bytes){
    for(let i=2;i<bytes.length-9;){
      if(bytes[i]!==255){i++;continue;}
      const marker=bytes[i+1]; if(marker===0xD8||marker===0xD9){i+=2;continue;}
      if(marker===0xDA) break;
      const length=(bytes[i+2]<<8)+bytes[i+3];
      if([0xC0,0xC1,0xC2,0xC3].includes(marker)) return {height:(bytes[i+5]<<8)+bytes[i+6],width:(bytes[i+7]<<8)+bytes[i+8]};
      i+=2+length;
    }
    throw new Error('Invalid JPEG image');
  }
  const jpegData = base64 => { const bin=atob(base64.split(',').pop()); const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)); return {...dimensions(bytes),bytes}; };
  const builtInLogo = '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';
  function loadLogo() { return jpegData(builtInLogo); }
  function loadPhoto(dataURL) {
    if(!dataURL) return null;
    try {
      // Photos are stored by the app as JPEG data URLs.
      return jpegData(dataURL);
    } catch {return null;}
  }
  window.PacificPDF={create,loadLogo,loadPhoto};
})();
