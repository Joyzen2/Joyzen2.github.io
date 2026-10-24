---
title: 金正 · 宏观利率研究
kind: home
summary: 金正的宏观利率研究：宏观信息在市场价格之外，能给固收组合带来什么增量。
---

{{raw:hero}}

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>研究主线</h2><a href="research/macro-vs-expectations/">读全文</a></div>
<div class="thesis">
<div>
<p>美林时钟这类框架，是从「宏观状态」直接推到「资产配置」。但价格是由预期定的：经济在走弱，如果大家早就知道，债券早就涨过了。</p>
<p>我用实时数据把中间这一环拆开检验，结论是：宏观信息要和市场已经反映的预期比，才谈得上增量。</p>
<p class="more"><a href="research/macro-vs-expectations/">宏观信息在市场价格之外，能给固收+ 组合带来什么增量</a></p>
</div>
<div>{{svg:chain}}</div>
</div>
</section>

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>三个发现</h2></div>
<div class="findings">
<div class="finding">
<h3>利率只为意外定价</h3>
{{svg:mini-lpr}}
<p>首发降息让 1 年期利率互换平均下行 7.5bp，跟在后面的 LPR 下调只有 −0.3bp。用互换度量的政策意外每 1bp，带动 10 年国债 0.62bp（t 5.9）。</p>
<a class="more" href="research/macro-vs-expectations/#surprise">在研究里看</a>
</div>
<div class="finding">
<h3>宏观状态择时不灵</h3>
{{svg:mini-brier}}
<p>实时状态概率的 Brier 分数比一直猜 50% 还差。等到实时确认的时候，行情已经走完，之后 6 个月股票平均反向 5.5%。</p>
<a class="more" href="research/macro-vs-expectations/#timing">在研究里看</a>
</div>
<div class="finding">
<h3>有增量的是期权，不是宏观</h3>
{{svg:mini-vol}}
<p>预测固收+ 组合下个月的波动，期权隐含波动相对市场基准的样本外 R² 达 5.5%（Clark-West t 2.1）；宏观变量一起加进去，反而差 7.1%。</p>
<a class="more" href="research/macro-vs-expectations/#risk">在研究里看</a>
</div>
</div>
</section>

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>持续跟踪</h2><a href="notes/">全部点评</a></div>
<p class="band-lede">每次重要的数据和政策发布写一页：公布值和一致预期比、意外多大、利率当天怎么动，最后是我的判断；每周五再写一页资金面。判断错了也留着，之后复盘。</p>
{{list:note}}
</section>

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>专题复盘</h2><a href="reviews/">全部复盘</a></div>
{{list:review}}
</section>

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>债券计算工具</h2><a href="tools/bond-analytics/">看工具</a></div>
<div class="split">
<div>
<p>自己写的 Python 包：定价、到期收益率、久期、凸性、关键期限久期，以及持有一段时间的票息加骑乘收益。每个公式都有单元测试对着数值导数核对。</p>
<p>每月用它算一次国债曲线各期限的票息加骑乘。10 月 22 日的曲线上，7–10 年这一段最厚，但 10 年期的安全垫只有约 1.7bp。</p>
<p class="more"><a href="https://github.com/Joyzen2/bond-analytics">代码在 GitHub</a></p>
</div>
<div>{{svg:cgb-curve}}</div>
</div>
</section>

<section class="band">
<div class="ruler" aria-hidden="true"></div>
<div class="band-head"><h2>关于我</h2><a href="about/">更多</a></div>
<dl class="facts">
<div class="fact"><dt>教育</dt><dd>利物浦大学金融计算硕士在读（在西交利物浦大学就读，2025–2027）</dd><dd>西交利物浦大学计算机科学与技术本科</dd></div>
<div class="fact"><dt>实习</dt><dd>中诚信托 · 量化研究员助理（2025.07–2025.12）</dd><dd>搭了宏观状态识别和资产配置框架；这里的研究是实习结束后重建、延伸的，不含任何公司数据。</dd></div>
<div class="fact"><dt>成果</dt><dd>已公开的发明专利一项（CN119606312A）</dd><dd>IEEE TrustCom 2024 会议论文</dd><dd>江苏省大学生生物医学工程创新设计竞赛二等奖</dd></div>
<div class="fact"><dt>联系</dt><dd><a href="mailto:zheng.jin20@student.xjtlu.edu.cn">zheng.jin20@student.xjtlu.edu.cn</a></dd><dd>全英文教学背景，听说读写流畅，雅思口语 7</dd></div>
</dl>
</section>
