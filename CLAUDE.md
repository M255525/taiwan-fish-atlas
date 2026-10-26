# CLAUDE.md — taiwan-fish-atlas（台灣漁港魚汛圖鑑）

動漫風 3D 台灣海圖：本島＋澎湖、金門、馬祖（含東引）、綠島、蘭嶼、小琉球、龜山島；34 個漁港依「月份 × 近海／遠海」顯示當月漁獲，魚在海裡游動（尾巴擺動、偶爾跳出水面＋水花），點魚開圖鑑（說明、棲息、挑選要訣、產季月曆、可捕漁港、烹飪方式、食譜、可列印）。無框架、無建置。2026-10-26 建立；同日使用者追加「月份軸線」（月份按鈕下方可拖曳的時間軸，長條＝每月近海／遠海可捕種數，底色＝四季）。

## 檔案
- `data.js`：`FA.ZONES / REGIONS / PORTS / ISLANDS / PEAKS / FISH` 全部手寫常數。魚的 `at:[{z:'near'|'far', r:'區域代碼空白分隔', m:'月份區間，可跨年 11-3、多段逗號'}]`，`hot` 是名產港，`body` 決定 3D 外型，`col=[背, 腹, 點綴]`。`FA.catchFor(region, zone, month)` 是唯一的查詢入口。**季節是一般性參考**，頁面、manual、警語都有註明；改資料後在瀏覽器跑覆蓋檢查（每個區域×海域×月份至少一種，目前刻意留空的只有少數冷門組合）。
- `scene.js`：`window.FishScene`。Three.js 0.160 由 importmap 指到 jsdelivr，`import('three')` 從 classic script 動態載入（file:// 也能跑）。
- `app.js`：介面與狀態；測試 hook `window.__fishAtlas`（`state/setMonth/setZone/selectPort/selectRegion/openFish/closeFish/listNow/groups3D/scene`），`FishScene.stats()` 看魚群／標籤數。
- `index.html`：版面、CSS、頂部跑馬燈（共用 Apps Script 端點、滑鼠移入暫停）。`manual.html`：使用說明＋創作者。

## 3D 實作重點
- 投影 `P(lon,lat)=[(lon-120.9)*10.17, -(lat-23.7)*11.1]`，1 單位≈10 公里；小島以 `c+km` 生成圓形輪廓並放大 1.5 倍。
- **離岸距離場** `FIELD`（0.25 格、海上正／陸上負）同時給：海面 shader（DataTexture 上色、近海 `NEAR=2.4`≈12 浬白虛線、遠海外圈 `NEAR+6.5` 點線、`uMode` 高亮目前海域）、海底平面、魚群落點（`placeAnchors` 在港口附近找符合海域帶的格點並保持間距）。
- 本島高度＝`RIDGES` 脊線高斯疊加（中央山脈、玉山、雪山、海岸山脈、陽明山、西部丘陵），山高 ×0.42 誇大；顏色依高度分段（沙／平原／草／林／岩／雪）＋三階 toon gradient。島嶼外緣往下延伸成淺海棚，透過半透明海面看得到（淺海底色要偏青綠，太像沙色魚會看起來游在沙灘上——踩過）。
- 魚全部程式自繪（`Geo.sweep/ell/stick/tri2`，合併成單一幾何＋頂點色），描邊＝同幾何 BackSide 法線外推；擺尾在 `onBeforeCompile` 依 `position.x` 做側向正弦波，相位用 `modelMatrix` 位置錯開。外型：spindle／tuna／deep／stocky／long（白帶）／bill（旗魚）／mahi／flyer（飛魚）／tiny、squid／bigfin／cuttle、octopus、shrimp／lobster、crab（橫著走）。
- 相機：OrbitControls＋`flyTo` 補間；`setViewOffset` 把投影中心往右側清單（手機為底部抽屜）以外的空白處挪。標籤是 HTML 疊層，依優先序做螢幕空間避讓（`labels`，`off` 初始必須為 true，否則永遠不顯示——踩過）。
- `prefers-reduced-motion`：海浪、擺尾、游速放慢，不跳水。

## 配套
- ✅ 跑馬燈、manual、使用警語、創作者資訊、RWD（375px 無橫向捲動）、localStorage `fishAtlasPrefs`（海域／區域／漁港；月份每次預設本月）、`fishAtlasMarquee`
- ❌ 序號授權（不需要）
- ✅ PWA（`manifest.json`＋`service-worker.js` network-first＋`icons/` 用 PIL 自畫：海＋島＋小黃魚；工具列「📲 加入主畫面」）
- ✅ 創作者資訊：清單面板底部常駐一行（點名字開「關於」彈窗的創作者區）＋關於彈窗＋manual `#creator`
- ✅ 訪客計數器（visitor-badge，`page_id=m255525.taiwanfishatlas`，在清單面板底部）
- ✅ GitHub Pages（2026-10-26 使用者要求上線）：公開 repo <https://github.com/M255525/taiwan-fish-atlas>，網址 <https://m255525.github.io/taiwan-fish-atlas/>，`master` 分支＋`.github/workflows/deploy-pages.yml`。改了 `data.js`／`scene.js`／`app.js` 記得把 `service-worker.js` 的 `CACHE_NAME` 版號 +1。

## Port／測試
- port **8836**（`.claude/launch.json` 的 `taiwan-fish-atlas`）；上線後程式牆已從 `LOCAL_APPS` 移除、改加 `REPO_META`（github-dashboard 同步）。
- 驗證：Playwright 開 `http://127.0.0.1:8836/`，用 `__fishAtlas.selectPort('donggang')`、`setZone('far')`、`setMonth(5)`、`openFish('sakura')`；console 應無錯誤；375px 寬 `scrollWidth===clientWidth`。
