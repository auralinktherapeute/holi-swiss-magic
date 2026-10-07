"""Actual UI at 390px/desktop; isolated fictional fixture, no app-data traffic.
Run: python3 scripts/tests/check-billing-mobile.py
Screenshots and results are written only under /tmp/browser/billing-mobile.
"""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('/tmp/browser/billing-mobile')
OUT.mkdir(parents=True, exist_ok=True)
ID = '00000000-0000-4000-8000-000000000001'
HTML = '''<html><head><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
await import('/src/styles.css');
const {default: React} = await import('/node_modules/.vite/deps/react.js');
const {createRoot} = await import('/node_modules/.vite/deps/react-dom_client.js');
const {QueryClient, QueryClientProvider} = await import('/node_modules/.vite/deps/@tanstack_react-query.js');
const {createRootRoute, createRouter, RouterProvider, createMemoryHistory} = await import('/node_modules/@tanstack/react-router/dist/esm/index.dev.js');
const {default: i18n} = await import('/node_modules/.vite/deps/i18next.js');
const {I18nextProvider} = await import('/node_modules/.vite/deps/react-i18next.js');
await i18n.init({lng:'fr', resources:{fr:{translation:{dashboard:{overview:'Vue d’ensemble',profile:'Profil',agenda:'Agenda'}}}}});
const {MobileDashboardBottomNav} = await import('/src/components/layout/MobileDashboardNav.tsx');
const {TestClientDialog} = await import('/src/routes/dashboard.clients.tsx?tsr-split=component');
const qc = new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
const id = '00000000-0000-4000-8000-000000000001';
qc.setQueryData(['cabinet-client',id], {client:{id,first_name:'Camille',last_name:'Exemple fictif',email:'camille@example.invalid',relation_status:'active',consent_at:'2026-10-01',country:'CH'},practice_currency:'CHF',balance_due:0,invoices:[],appointments:[],payments:[],tasks:[],balances_by_currency:[]});
qc.setQueryData(['client-invoices',id], []);
qc.setQueryData(['billing-services'], []);
qc.setQueryData(['tariff-positions'], []);
function Fixture(){return React.createElement(React.Fragment,null,React.createElement(MobileDashboardBottomNav),React.createElement('button',{onClick:()=>window.showClient()},'Ouvrir fiche fictive'),React.createElement(Client));}
function Client(){const [open,setOpen]=React.useState(false);window.showClient=()=>setOpen(true);return open ? React.createElement(TestClientDialog,{id,onClose:()=>setOpen(false)}) : null;}
const root = createRootRoute({component:Fixture});
const router = createRouter({routeTree:root,history:createMemoryHistory({initialEntries:['/']})});
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:qc},React.createElement(I18nextProvider,{i18n},React.createElement(RouterProvider,{router}))));
</script></head><body><div id="root"></div></body></html>'''

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width':1280,'height':1800})
        page = await context.new_page()
        blocked = []
        errors = []
        page.on('pageerror', lambda e: (errors.append(str(e)), print('PAGE ERROR:', str(e))))
        async def isolate(route):
            url = route.request.url
            if not url.startswith('http://localhost:8080/') or '/_serverFn/' in url or route.request.method != 'GET':
                blocked.append(url.split('?')[0]); await route.abort(); return
            if '/__billing-test' in url:
                await route.fulfill(body=HTML,content_type='text/html'); return
            if '/__mock-server-fn.js' in url:
                await route.fulfill(body="export const useServerFn = () => async () => {throw new Error('All server calls forbidden in fixture');};",content_type='text/javascript'); return
            if '/src/' in url and '.tsx' in url:
                response = await route.fetch()
                body = await response.text()
                body = re.sub(r'import \{ useServerFn \} from "[^"]+";', 'import { useServerFn } from "/__mock-server-fn.js";', body)
                if 'dashboard.clients.tsx' in url and 'tsr-split' in url:
                    body += '\nexport { ClientDialog as TestClientDialog };'
                await route.fulfill(response=response,body=body); return
            await route.continue_()
        await context.route('**/*', isolate)
        await page.goto('http://localhost:8080/__billing-test')
        await page.get_by_role('button',name='Ouvrir fiche fictive').wait_for()
        for width,height in [(390,844),(390,600),(1280,1800)]:
            await page.set_viewport_size({'width':width,'height':height})
            if width == 390:
                await page.get_by_role('button',name='Menu',exact=True).click()
                menu = page.get_by_role('dialog',name='Menu',exact=True)
                await menu.get_by_role('link',name='Clients',exact=True).scroll_into_view_if_needed()
                assert await menu.get_by_role('link',name='Clients',exact=True).get_attribute('href') == '/dashboard/clients'
                await menu.screenshot(path=str(OUT/f'menu-{width}-{height}.png'))
                await page.keyboard.press('Escape')
            await page.get_by_role('button',name='Ouvrir fiche fictive').click()
            client = page.get_by_role('dialog',name='Camille Exemple fictif',exact=True)
            await client.wait_for()
            await assert_bounds(client,width,height)
            await client.get_by_role('button',name='Close',exact=True).is_visible()
            create = client.get_by_role('button',name='Créer une facture',exact=True)
            assert await create.is_visible()
            tabs = client.get_by_role('tablist')
            await tabs.scroll_into_view_if_needed()
            assert await tabs.get_by_role('tab').count() == 9
            await client.screenshot(path=str(OUT/f'client-{width}-{height}.png'))
            await create.click()
            invoice = page.get_by_role('dialog',name='Créer une facture',exact=True)
            await invoice.wait_for()
            await invoice.get_by_label('Description',exact=True).fill('Séance fictive')
            await invoice.get_by_label('Prix unitaire',exact=True).fill('100')
            await invoice.get_by_role('button',name='Ajouter une ligne').click()
            await invoice.get_by_label('Description',exact=True).nth(1).fill('Deuxième ligne fictive')
            await invoice.get_by_label('Prix unitaire',exact=True).nth(1).fill('50')
            await invoice.get_by_label('TVA (%)',exact=True).nth(0).fill('8.1')
            await assert_bounds(invoice,width,height)
            for name in ['Annuler','Enregistrer comme brouillon','Créer sans encaisser','Créer et encaisser']:
                action = invoice.get_by_role('button',name=name,exact=True)
                await action.scroll_into_view_if_needed()
                assert await action.is_visible()
                box = await action.bounding_box()
                assert box and box['y'] >= 0 and box['y']+box['height'] <= height
            await invoice.screenshot(path=str(OUT/f'invoice-{width}-{height}.png'))
            await invoice.get_by_role('button',name='Créer et encaisser',exact=True).click()
            await invoice.get_by_label('Date du paiement').scroll_into_view_if_needed()
            await assert_bounds(invoice,width,height)
            assert await invoice.get_by_role('button',name='Confirmer : créer et encaisser').is_disabled()
            await invoice.screenshot(path=str(OUT/f'confirmation-{width}-{height}.png'))
            await invoice.get_by_role('button',name='Annuler',exact=True).click()
            assert await client.is_visible()
            await client.get_by_role('button',name='Close',exact=True).click()
            results.append({'viewport':[width,height],'menu':width==390,'client':'OK','twoLines':'OK','actions':'OK','confirmation':'disabled','submitted':False})
        assert not blocked, blocked
        assert not errors, errors
        (OUT/'results.json').write_text(json.dumps({'results':results,'blockedDataRequests':len(blocked),'errors':errors},indent=2))
        print(json.dumps(results,ensure_ascii=False))
        await browser.close()

async def assert_bounds(dialog,width,height):
    box = await dialog.bounding_box()
    assert box and box['x'] >= -1 and box['y'] >= -1 and box['x']+box['width'] <= width+1 and box['y']+box['height'] <= height+1, box
    assert await dialog.evaluate('(e)=>e.scrollWidth <= e.clientWidth'), 'dialog horizontal overflow'
    assert await dialog.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'page horizontal overflow'

asyncio.run(main())