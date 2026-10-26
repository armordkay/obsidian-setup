"""Exercise the built plugin in Firefox with a simulated Obsidian host. No screenshots."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import urllib.request

firefox = os.environ.get('FIREFOX_BINARY') or '/snap/firefox/current/usr/lib/firefox/firefox'
geckodriver = os.environ.get('GECKODRIVER_BINARY') or shutil.which('geckodriver') or '/snap/firefox/current/usr/lib/firefox/geckodriver'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = os.environ.get('GECKODRIVER_URL') or f'http://127.0.0.1:{port}'
driver = None if os.environ.get('GECKODRIVER_URL') else subprocess.Popen([geckodriver, '--port', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def request(method, path, value=None):
    body = json.dumps(value).encode() if value is not None else None
    req = urllib.request.Request(base + path, data=body, method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=25) as response:
        result = json.load(response)['value']
    if isinstance(result, dict) and 'error' in result:
        raise RuntimeError(result)
    return result

session = None
try:
    for _ in range(60):
        try:
            request('GET', '/status')
            break
        except OSError:
            time.sleep(.1)
    session = request('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'firefox', 'moz:firefoxOptions': {'binary': firefox, 'args': ['-headless']}}}})['sessionId']
    prefix = '/session/' + session
    def js(script):
        return request('POST', prefix + '/execute/sync', {'script': script, 'args': []})
    def wait_for(expression):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if js('return !!(' + expression + ');'):
                return
            time.sleep(.05)
        raise AssertionError('Timed out: ' + expression)
    request('POST', prefix + '/window/rect', {'width': 1440, 'height': 1080})
    request('POST', prefix + '/url', {'url': Path(__file__).with_name('preview.html').resolve().as_uri()})
    wait_for('window.dashboardTest && dashboardTest.plugin.boards.size===1')
    wait_for("document.querySelector('.db-avatar')?.complete && document.querySelector('.db-avatar').naturalWidth===1350")
    for mode in ['dark', 'light']:
        js(f"document.body.className='theme-{mode}';")
        for width in [1440, 700, 390, 280]:
            request('POST', prefix + '/window/rect', {'width': width, 'height': 1080})
            js(f"document.getElementById('host').style.width='{width}px';")
            result = js("""
                const root=document.querySelector('.vault-dashboard'), input=root.querySelector('.db-search input');input.focus();
                const bar=root.querySelector('.db-search'), c=getComputedStyle(bar), ic=getComputedStyle(input);
                const green=getComputedStyle(root.querySelector('.db-year')).color;
                const levels=[1,2,3].map(i=>getComputedStyle(root.querySelector('.db-cells .db-l'+i)).backgroundColor);
                const rootStyle=getComputedStyle(root),compact=root.clientWidth-parseFloat(rootStyle.paddingLeft)-parseFloat(rootStyle.paddingRight)<=600;
                const intro=root.querySelector('.db-intro').getBoundingClientRect(),weekdayStyle=getComputedStyle(root.querySelector('.db-weekday'));
                const dateEl=root.querySelector('.db-date-block'),dateStyle=getComputedStyle(dateEl),date=dateEl.getBoundingClientRect(),avatar=root.querySelector('.db-avatar-frame').getBoundingClientRect(),setup=root.querySelector('.db-setup-toggle').getBoundingClientRect();
                const weekday=root.querySelector('.db-weekday'),heading=root.querySelector('.db-date-block h1'),clock=root.querySelector('.db-clock');
                let allDatesFit=true;const oldWeekday=weekday.textContent;
                for(const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']){weekday.textContent=day;for(const value of ['Oct 1, 2026','Oct 27, 2026','Sep 30, 2026']){heading.textContent=value;allDatesFit &&= (compact || Math.abs(clock.getBoundingClientRect().bottom-avatar.bottom)<1) && heading.getBoundingClientRect().bottom<=clock.getBoundingClientRect().top+1 && weekday.scrollWidth<=weekday.clientWidth+1;}}
                weekday.textContent=oldWeekday;heading.replaceChildren();[...dashboardTest.plugin.boards][0].renderHeader();
                return {compact,allDatesFit,overflow:document.documentElement.scrollWidth>innerWidth,focus:bar.matches(':focus-within'),outline:ic.outlineStyle,
                  inputBackground:ic.backgroundColor,inset:c.boxShadow,green,levels,avatarLeft:avatar.right<=date.left,square:Math.abs(avatar.width-avatar.height)<1,avatarRadius:parseFloat(getComputedStyle(root.querySelector('.db-avatar-frame')).borderRadius),dateAlign:getComputedStyle(root.querySelector('.db-date-block')).textAlign,clock:root.querySelector('.db-clock').textContent,calendar:!!root.querySelector('.db-calendar'),
                  dateMarginTop:parseFloat(getComputedStyle(heading).marginTop),weekdayTop:root.querySelector('.db-weekday').getBoundingClientRect().top-avatar.top,clockBottom:root.querySelector('.db-clock').getBoundingClientRect().bottom-avatar.bottom,avatarInset:avatar.left-intro.left,dateSize:parseFloat(getComputedStyle(root.querySelector('.db-date-block h1')).fontSize),clockSize:parseFloat(getComputedStyle(root.querySelector('.db-clock')).fontSize),weekdaySize:parseFloat(weekdayStyle.fontSize),weekdayGap:parseFloat(weekdayStyle.marginBottom),summaryLabels:[...root.querySelectorAll('.db-summary > span > span')].map(el=>el.textContent),dividerWidth:dateStyle.borderLeftWidth,dividerStyle:dateStyle.borderLeftStyle,dividerColor:dateStyle.borderLeftColor,dividerHeight:date.height,avatarHeight:avatar.height,datePadding:parseFloat(dateStyle.paddingLeft),avatarGap:date.left-avatar.right,
                  setupCompact:setup.width<=110 && setup.width>setup.height*1.5,setupWhiteSpace:getComputedStyle(root.querySelector('.db-setup-toggle')).whiteSpace,
                  setupText:root.querySelector('.db-setup-toggle').textContent,setupBackground:getComputedStyle(root.querySelector('.db-setup-toggle')).backgroundColor,
                  columns:getComputedStyle(root.querySelector('.db-cells')).gridTemplateColumns.split(' ').length,
                  tabStops:[...root.querySelectorAll('.db-cells button')].filter(b=>b.tabIndex===0).length};
            """)
            assert not result['overflow'], (mode, width, result)
            assert result['focus'] and result['outline'] == 'none' and 'inset' in result['inset']
            assert result['inputBackground'] == 'rgba(0, 0, 0, 0)'
            assert result['columns'] == 53 and result['tabStops'] == 1
            assert result['avatarLeft'] and result['square'] and result['avatarRadius']>0 and not result['calendar'], result
            assert result['dateAlign']=='left' and result['clock']=='12:00', result
            assert result['dividerWidth']=='1px' and result['dividerStyle']=='solid', result
            assert result['dividerColor']==('rgb(59, 69, 78)' if mode=='dark' else 'rgb(196, 206, 215)'), result
            assert result['dividerHeight']>=result['avatarHeight']-1 and result['datePadding']>=16 and result['avatarGap']>=18, result
            assert abs(result['avatarInset'])<1 and 13<=result['weekdaySize']<=24 and result['weekdayGap']<=2, result
            assert 18<=result['dateSize']<=60 and 18<=result['clockSize']<=36, result
            assert result['allDatesFit'], result
            assert abs(result['weekdayTop'])<1, result
            assert result['dateMarginTop']==(0 if result['compact'] else 12), result
            if not result['compact']:
                assert abs(result['clockBottom'])<1 and abs(result['dividerHeight']-result['avatarHeight'])<1, result
            else:
                assert result['weekdaySize']>=20 and result['dateSize']>=30 and result['clockSize']>=24, result
            assert result['summaryLabels']==['active days','deep_work','wins'], result
            assert result['setupCompact'] and result['setupWhiteSpace']=='nowrap', result
            expected = ['rgb(53, 93, 73)', 'rgb(80, 139, 104)', 'rgb(122, 198, 166)'] if mode == 'dark' else ['rgb(182, 216, 195)', 'rgb(114, 179, 139)', 'rgb(39, 134, 83)']
            assert result['levels'] == expected, result
            assert result['setupText']=='Set up'
            assert result['setupBackground']==('rgb(122, 198, 166)' if mode=='dark' else 'rgb(21, 118, 87)')
            js("[...dashboardTest.plugin.boards][0].showSetup();")
            assert js("return !document.querySelector('.db-setup').hidden && document.documentElement.scrollWidth<=innerWidth;"), (mode,width,'Setup overflow')
            assert js("const b=[...dashboardTest.plugin.boards][0];return !b.ruleFields[0].thresholdLabel.hidden && b.ruleFields[1].thresholdLabel.hidden;")
            js("[...dashboardTest.plugin.boards][0].closeSetup();")
            print('PASS theme/layout/focus:', mode, width)
    # A wide window with a narrow Obsidian pane still follows the container.
    request('POST', prefix + '/window/rect', {'width': 1440, 'height': 1080})
    js("document.getElementById('host').style.width='500px';")
    assert js("const r=document.querySelector('.vault-dashboard');return r.querySelector('.db-avatar-frame').getBoundingClientRect().right<=r.querySelector('.db-date-block').getBoundingClientRect().left;")
    js("document.getElementById('host').style.width='100%';")
    print('PASS narrow pane in wide window')
    # Match Markdown embed typography to catch host heading/time margins.
    js("const host=document.getElementById('host');host.classList.add('markdown-rendered');const s=document.createElement('style');s.id='host-typography';s.textContent='.markdown-rendered h1 {margin-block:24px 16px;padding-block:8px} .markdown-rendered time {margin-block:12px 16px;padding-block:4px}';document.head.append(s);")
    assert js("const root=document.querySelector('.vault-dashboard'),a=root.querySelector('.db-avatar-frame').getBoundingClientRect(),c=root.querySelector('.db-clock').getBoundingClientRect(),h=root.querySelector('h1').getBoundingClientRect();return Math.abs(a.bottom-c.bottom)<1 && h.bottom<=c.top && getComputedStyle(root.querySelector('h1')).marginBottom==='0px';")
    js("document.getElementById('host-typography').remove();document.getElementById('host').classList.remove('markdown-rendered');")
    print('PASS desktop clock/avatar alignment under Markdown host spacing')
    js("const p=dashboardTest.plugin;p.now=()=>new Date(2026,9,26,13,5);p.checkToday();")
    wait_for("document.querySelector('.db-clock').textContent==='13:05'")
    js("const p=dashboardTest.plugin;p.now=()=>new Date(2026,9,26,12);p.checkToday();")
    wait_for("document.querySelector('.db-clock').textContent==='12:00'")
    print('PASS shared clock update and HH:mm format')
    js("const b=[...dashboardTest.plugin.boards][0];b.search.focus();b.search.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));b.search.value='Đọc';b.search.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'ọc'}));")
    wait_for("document.querySelector('.db-result-name')?.textContent==='Đọc sách.md'")
    assert js("const b=[...dashboardTest.plugin.boards][0];return b.composing && b.search.value==='Đọc' && document.activeElement===b.search;")
    assert js("const b=[...dashboardTest.plugin.boards][0],before=dashboardTest.opened.length;const e=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});b.search.dispatchEvent(e);return !e.defaultPrevented && dashboardTest.opened.length===before;")
    js("document.querySelector('.db-search input').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'Đọc'}));document.querySelector('.db-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));")
    js("document.querySelector('.db-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));")
    wait_for("dashboardTest.opened.includes('Study/Đọc sách.md')")
    # Current query wins over an older visible result even before debounce fires.
    js("const b=[...dashboardTest.plugin.boards][0];b.search.value='note-taking';b.runSearch();b.search.value='dashboard';b.search.dispatchEvent(new Event('input'));b.search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));")
    wait_for("dashboardTest.opened.includes('Ideas/Obsidian Dashboard.md')")
    print('PASS live Vietnamese composition suggestions, untouched IME Enter, selection, file opening and debounce regression')
    js("const f=dashboardTest.files.find(f=>f.path==='Daily/2026-10-26.md');dashboardTest.cache.set(f.path,{frontmatter:{date:'2026-10-26',deep_work:60,wins:''}});dashboardTest.app.metadataCache.trigger('changed',f);")
    wait_for("document.querySelector('.db-cells button[data-day=\"2026-10-26\"]').classList.contains('db-l2')")
    js("document.querySelector('.db-cells button[data-day=\"2026-10-26\"]').click();")
    assert js("return document.querySelector('.db-detail p').textContent.includes('deep_work: 60');")
    js("const b=document.querySelector('.db-cells button[data-day=\"2026-10-26\"]');b.focus();b.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));")
    assert js("return document.activeElement.getAttribute('data-day')==='2026-10-19';")
    js("document.querySelector('.db-cells .db-l0').click();")
    assert js("return document.querySelector('.db-detail button').disabled;")
    print('PASS metadata updates, cell details, heatmap keyboard and missing day')
    js("""
        const b=[...dashboardTest.plugin.boards][0];b.setupButton.click();
        b.ruleFields[0].property.value='reading';b.ruleFields[0].type.value='text';b.ruleFields[0].type.dispatchEvent(new Event('change'));
        b.ruleFields[1].property.value='exercise';b.ruleFields[1].type.value='number';b.ruleFields[1].type.dispatchEvent(new Event('change'));b.ruleFields[1].threshold.value='';
        b.setupSave.click();
    """)
    assert js("const b=[...dashboardTest.plugin.boards][0];return !b.setupError.hidden && b.setupError.textContent.includes('minimum');")
    js("const b=[...dashboardTest.plugin.boards][0];b.ruleFields[1].threshold.value='30';b.setupSave.click();")
    wait_for("dashboardTest.plugin.settings.level3.property==='exercise' && document.querySelector('.db-setup').hidden")
    js("const f=dashboardTest.files.find(f=>f.path==='Daily/2026-10-26.md');dashboardTest.cache.set(f.path,{frontmatter:{date:'2026-10-26',reading:'One page',exercise:30}});dashboardTest.app.metadataCache.trigger('changed',f);")
    wait_for("document.querySelector('.db-cells button[data-day=\"2026-10-26\"]').classList.contains('db-l3')")
    assert js("return dashboardTest.plugin.saved.settings.level3.threshold===30 && document.querySelector('.db-swatch.db-l2').title==='reading has text';")
    print('PASS Setup controls, text/number switching, invalid threshold, saved rules and live custom levels')
    js("[...dashboardTest.plugin.boards][0].setupButton.click();")
    upload=request('POST',prefix+'/element',{'using':'css selector','value':'.db-setup input[type="file"]'})
    upload_id=upload['element-6066-11e4-a52e-4f735466cecf']
    request('POST',prefix+'/element/'+upload_id+'/value',{'text':str(Path(__file__).resolve().parent.parent/'assets'/'ryo.png')})
    assert js("const b=[...dashboardTest.plugin.boards][0];return b.pendingAvatar?.name==='ryo.png' && !dashboardTest.plugin.settings.avatarPath;")
    js("[...dashboardTest.plugin.boards][0].setupSave.click();")
    wait_for("dashboardTest.plugin.settings.avatarPath.startsWith('.obsidian/plugins/dashboard/images/') && document.querySelector('.db-setup').hidden")
    wait_for("document.querySelector('.db-avatar').src.startsWith('blob:') && document.querySelector('.db-avatar').naturalWidth===1000")
    assert js("return dashboardTest.plugin.saved.settings.avatarPath===dashboardTest.plugin.settings.avatarPath && dashboardTest.imageFiles.get(dashboardTest.plugin.settings.avatarPath).type==='file';")
    print('PASS native file input, avatar copy destination, saved selection and loaded custom image')
    # Embeds share state and detach without leaving a subscribed renderer.
    js("const t=dashboardTest;const el=document.createElement('div');document.body.append(el);const ctx=new t.Component();ctx.load();t.plugin.embed('',el,ctx);t.embedContext=ctx;t.embedEl=el;")
    assert js('return dashboardTest.plugin.boards.size===2;')
    wait_for("[...document.querySelectorAll('.db-avatar')].every(img=>img.complete&&img.naturalWidth===1000&&img.src.startsWith('blob:'))")
    js('dashboardTest.embedContext.unload();dashboardTest.embedEl.remove();')
    assert js('return dashboardTest.plugin.boards.size===1 && dashboardTest.plugin.listeners.size===1;')
    print('PASS multiple views and embed cleanup')
    js("const b=[...dashboardTest.plugin.boards][0];b.setupButton.click();b.avatarResetButton.click();b.setupSave.click();")
    wait_for("!dashboardTest.plugin.settings.avatarPath && document.querySelector('.db-avatar').src.startsWith('data:') && document.querySelector('.db-avatar').naturalWidth===1350")
    assert js("return [...dashboardTest.imageFiles.values()].filter(item=>item.type==='file').length===1;")
    print('PASS default-avatar reset and retained imported image')
    assert js('return dashboardErrors.length===0;'), js('return dashboardErrors;')
    js('dashboardTest.plugin.unload();')
    assert js('return !document.querySelector(".vault-dashboard") && dashboardTest.plugin.listeners.size===0;')
    print('PASS unload and no browser errors. No screenshots created.')
finally:
    if session:
        request('DELETE', '/session/' + session)
    if driver:
        driver.terminate()
