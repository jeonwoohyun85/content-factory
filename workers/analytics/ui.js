// Analytics SPA UI Generator
export function generateAnalyticsSPA(subdomain, siteTitle) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>\${siteTitle} - 통계</title>
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f8fafc}
.app{display:flex;min-height:100vh}
.sidebar{width:260px;background:#fff;border-right:1px solid #e2e8f0;padding:30px 0;position:fixed;height:100vh}
.logo{padding:0 30px 30px;font-size:24px;font-weight:800;color:#1e293b}
.nav-item{padding:12px 30px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px;color:#64748b;font-size:14px}
.nav-item:hover{background:#f1f5f9;color:#1e293b}
.nav-item.active{background:#3b82f6;color:#fff;border-left:4px solid #2563eb}
.main{flex:1;margin-left:260px;padding:30px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}
.header h1{font-size:28px;color:#1e293b}
.back-btn{padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;text-decoration:none;color:#64748b}
.filters{background:#fff;padding:20px;border-radius:12px;margin-bottom:30px;display:flex;gap:15px;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.filter-btn{padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;transition:all .2s}
.filter-btn.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:30px}
.stat-card{background:#fff;padding:25px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.stat-label{font-size:14px;color:#64748b;margin-bottom:10px}
.stat-value{font-size:32px;font-weight:700;color:#1e293b}
.chart-card{background:#fff;padding:25px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.chart-card h3{font-size:16px;color:#1e293b;margin-bottom:20px}
.chart-card.full{grid-column:1/-1}
.list-item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9}
.list-label{font-size:14px;color:#1e293b}
.list-value{font-size:14px;font-weight:600;color:#3b82f6}
.loading{display:flex;justify-content:center;align-items:center;height:400px}
.spinner{border:3px solid #f3f4f6;border-top:3px solid #3b82f6;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.realtime-badge{display:inline-block;background:#10b981;color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;margin-left:8px}
</style></head>
<body>
<div id="app">
<div class="app">
<div class="sidebar">
<div class="logo">📊 통계</div>
<div :class="['nav-item',{active:currentView==='dashboard'}]" @click="currentView='dashboard'"><span>📈</span> 대시보드</div>
<div :class="['nav-item',{active:currentView==='realtime'}]" @click="currentView='realtime'"><span>⚡</span> 실시간</div>
<div :class="['nav-item',{active:currentView==='countries'}]" @click="currentView='countries'"><span>🌍</span> 국가별</div>
<div :class="['nav-item',{active:currentView==='referrers'}]" @click="currentView='referrers'"><span>🔗</span> 유입 경로</div>
<div :class="['nav-item',{active:currentView==='pages'}]" @click="currentView='pages'"><span>📄</span> 페이지별</div>
<div :class="['nav-item',{active:currentView==='devices'}]" @click="currentView='devices'"><span>📱</span> 기기별</div>
</div>
<div class="main">
<div class="header"><h1>\${siteTitle}</h1><a href="/" class="back-btn">← 홈으로</a></div>
<div class="filters">
<span>기간:</span>
<button :class="['filter-btn',{active:dateRange==='1day'}]" @click="changeDateRange('1day')">오늘</button>
<button :class="['filter-btn',{active:dateRange==='7days'}]" @click="changeDateRange('7days')">7일</button>
<button :class="['filter-btn',{active:dateRange==='30days'}]" @click="changeDateRange('30days')">30일</button>
<button :class="['filter-btn',{active:dateRange==='90days'}]" @click="changeDateRange('90days')">90일</button>
</div>
<div v-if="loading" class="loading"><div class="spinner"></div></div>
<div v-else>
<div class="stats-grid">
<div class="stat-card"><div class="stat-label">전체 방문</div><div class="stat-value">{{stats.total||0}}</div></div>
<div class="stat-card"><div class="stat-label">오늘 방문</div><div class="stat-value">{{stats.today_visits||0}}<span v-if="stats.realtime_visits>0" class="realtime-badge">{{stats.realtime_visits}} 실시간</span></div></div>
<div class="stat-card"><div class="stat-label">주간 방문</div><div class="stat-value">{{stats.weekly_visits||0}}</div></div>
<div class="stat-card"><div class="stat-label">월간 방문</div><div class="stat-value">{{stats.monthly_visits||0}}</div></div>
</div>
<div v-if="currentView==='realtime'" class="chart-card full"><h3>⚡ 실시간 방문자</h3><div style="padding:40px;text-align:center"><div style="font-size:64px;color:#10b981">{{stats.realtime_visits||0}}</div></div></div>
<div v-if="currentView==='countries'" class="chart-card full"><h3>🌍 국가별 상세</h3><div v-for="c in countries" class="list-item"><span class="list-label">{{c.country}}</span><span class="list-value">{{c.visits}}</span></div></div>
<div v-if="currentView==='referrers'" class="chart-card full"><h3>🔗 유입 경로</h3><div v-for="r in referrers" class="list-item"><span class="list-label">{{r.referrer}}</span><span class="list-value">{{r.visits}}</span></div></div>
<div v-if="currentView==='pages'" class="chart-card full"><h3>📄 페이지별</h3><div v-for="p in pages" class="list-item"><span class="list-label">{{p.pathname}}</span><span class="list-value">{{p.visits}}</span></div></div>
<div v-if="currentView==='devices'" class="chart-card full"><h3>📱 기기별</h3><div v-for="d in devices" class="list-item"><span class="list-label">{{d.device_type}}</span><span class="list-value">{{d.visits}}</span></div></div>
</div>
</div>
</div>
</div>
<script>
Vue.createApp({
data(){return{currentView:'dashboard',dateRange:'7days',loading:true,stats:{},countries:[],referrers:[],pages:[],devices:[]}},
methods:{
async loadData(){this.loading=true;try{const[a,b,c,d,e]=await Promise.all([fetch(\`/stats/api/summary?range=\${this.dateRange}\`),fetch(\`/stats/api/countries?range=\${this.dateRange}\`),fetch(\`/stats/api/referrers?range=\${this.dateRange}\`),fetch(\`/stats/api/pages?range=\${this.dateRange}\`),fetch(\`/stats/api/devices?range=\${this.dateRange}\`)]);this.stats=await a.json();this.countries=await b.json();this.referrers=await c.json();this.pages=await d.json();this.devices=await e.json()}catch(e){console.error(e)}finally{this.loading=false}},
changeDateRange(r){this.dateRange=r;this.loadData()}
},
mounted(){this.loadData();setInterval(()=>{if(this.currentView==='realtime')this.loadData()},30000)}
}).mount('#app')
</script>
</body>
</html>`;
}
