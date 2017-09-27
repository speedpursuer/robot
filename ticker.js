// botvs@3b3449dc5eac718353f3102f566801aa

var TickInterval = 1000;
var SlidePrice = 0.1;
var feeTimeout = 30 * 60000;
var feeCache = new Array();

var times = 0;

var state;

function main() {
	// var e = exchanges[1];
 //  	var depth = e.GetDepth();    // 获取市场深度
 //  	Log("depth:", depth);                   // 日志输出显示
 //  	Log(e.GetAccount());         // 输出 吃单前的 账户信息
 //  	var buyPrice = depth.Asks[0].Price;     // 设置吃卖单的价格，即卖一，
 //                                          // 有时为确保吃单成功，这样处理：var buyPrice = depth.Asks[0].Price + slidePrice;
 //  	var buyAmount = depth.Asks[0].Amount;   // 吃卖单的量
 //  	e.Buy(buyPrice, buyAmount);  // 执行买入操作， 吃掉卖一 这个单子
 //  	Log(e.GetAccount());         // 显示买入后的  账户信息，对比初始账户信息。可以对比出 买入操作的成交的数量。

 	LogReset();
    LogProfitReset();

    // initState = getExchangesState(true);                      // 调用自定义的 getExchangesState 函数获取到 所有交易所的信息， 赋值给 initState 
    // if (initState.allStocks == 0) {                       // 如果 所有交易所 币数总和为0  ，抛出错误。
    //     throw "所有交易所货币数量总和为空, 必须先在任一交易所建仓才可以完成对冲";
    // }
    // if (initState.allBalance == 0) {                      // 如果 所有交易所 钱数总和为0  ，抛出错误。
    //     throw "所有交易所CNY数量总和为空, 无法继续对冲";
    // }

    // for (var i = 0; i < initState.details.length; i++) {  // 遍历获取的交易所状态中的 details数组。
    //     var e = initState.details[i];                     // 把当前索引的交易所信息赋值给e 
    //     Log(e.exchange.GetName(), e.exchange.GetCurrency(), e.account);   // 调用e 中引用的 交易所对象的成员函数 GetName ， GetCurrency , 和 当前交易所信息中储存的 账户信息 e.account  用Log 输出。 
    // }

    // Log("ALL: Balance: ", initState.allBalance, "Stocks: ", initState.allStocks, "Ver:", Version());  // 打印日志 输出 所有添加的交易所的总钱数， 总币数， 托管者版本
    // Log("开始获取数据", "@");

    state = getExchangesState();

 	while (true) {                                        // while 循环
        onTick();                                         // 执行主要 逻辑函数 onTick 
        Sleep(parseInt(TickInterval));
    }
}

function getExchangeDetails() {
    var accounts = [];
    var tickers = [];
    while (true) {
        for (var i = 0; i < exchanges.length; i++) {
            if (accounts[i] == null) {
                // 创建异步操作
                accounts[i] = exchanges[i].Go("GetAccount");
            }
            if (tickers[i] == null) {
                // 创建异步操作
                tickers[i] = exchanges[i].Go("GetTicker");
            }
        }
        var failed = 0;
        for (var i = 0; i < exchanges.length; i++) {
            if (typeof(accounts[i].wait) != "undefined") {
                // 等待结果
                var ret = accounts[i].wait(1000);
                if (ret) {
                    accounts[i] = ret;
                    // Log(exchanges[i].GetName(), accounts[i]);
                } else {
                    // 重试
                    accounts[i] = null;
                    failed++;
                }
            }
            if (typeof(tickers[i].wait) != "undefined") {
                // 等待结果
                var ret = tickers[i].wait(1000);
                if (ret) {
                    tickers[i] = ret;
                    // Log(exchanges[i].GetName(), accounts[i]);
                } else {
                    // 重试
                    tickers[i] = null;
                    failed++;
                }
            }
        }
        if (failed == 0) {
            break;
        } else {
            Sleep(1000);
        }
    }
    return {accounts: accounts, tickers: tickers} ;
}

function onTick() {

	times++;

	if(times == 2) {
		state = getExchangesState();
		Log("updated state");
		times = 0;
	}
	
	updateStatePrice(state);

	var details = state.details;     // 取出 state 中的 details 值
    var tickers = state.tickers;
    for (var i = 0; i < details.length; i++) {      //  遍历 details 这个数组             	
        Log(details[i].exchange.GetName() + ", Buy: " + details[i].ticker.Buy + ", Sell: " + details[i].ticker.Sell + ", Stocks: " + details[i].account.Stocks + ", Balance: " + details[i].account.Balance);
    }
    Log("***************************");
}

function getExchangesState() {
    var allStocks = 0;                                              // 所有的币数
    var allBalance = 0;                                             // 所有的钱数
    var minStock = 0;                                               // 最小交易 币数
    var details = [];                                               // details 储存详细内容 的数组。
    var exchangeDetails = getExchangeDetails();
    var accounts = exchangeDetails.accounts;
    var tickers = exchangeDetails.tickers;
    for (var i = 0; i < exchanges.length; i++) {                    // 遍历 交易所对象数组        
        exchanges[i].SetPrecision(2, 5);                            // 设置价格小数位精度为2位, 品种下单量小数位精度为3位
        allStocks += accounts[i].Stocks + accounts[i].FrozenStocks;         // 累计所有 交易所币数
        allBalance += accounts[i].Balance + accounts[i].FrozenBalance;      // 累计所有 交易所钱数
        minStock = Math.max(minStock, exchanges[i].GetMinStock());  // 设置最小交易量minStock  为 所有交易所中 最小交易量最大的值
        details.push({exchange: exchanges[i], account: accounts[i]});   // 把每个交易所对象 和 账户信息 组合成一个对象压入数组 details 
    }
    return {allStocks: adjustFloat(allStocks), allBalance: adjustFloat(allBalance), minStock: minStock, details: details, tickers: tickers};   // 返回 所有交易所的 总币数，总钱数 ，所有最小交易量中的最大值， details数组
}

function updateStatePrice(state) {        // 更新 价格
    var now = (new Date()).getTime();     // 记录 当前时间戳
    for (var i = 0; i < state.details.length; i++) {    // 根据传入的参数 state（getExchangesState 函数的返回值），遍历 state.details
        // var ticker = null;                              // 声明一个 变量 ticker
        var key = state.details[i].exchange.GetName() + state.details[i].exchange.GetCurrency();  // 获取当前索引 i  的 元素，使用其中引用的交易所对象 exchange ,调用GetName、GetCurrency函数
                                                                                                  // 交易所名称 + 币种 字符串 赋值给 key ，作为键
        var fee = null;                                                                           // 声明一个变量 Fee
        // while (!(ticker = state.details[i].exchange.GetTicker())) {                               // 用当前 交易所对象 调用 GetTicker 函数获取 行情，获取失败，执行循环
        //     Sleep(Interval);                                                                      // 执行 Sleep 函数，暂停 Interval 设置的毫秒数
        // }

        var ticker = state.tickers[i];

        if (key in feeCache) {                                                                    // 在feeCache 中查询，如果找到 key
            var v = feeCache[key];                                                                // 取出 键名为 key 的变量值
            if ((now - v.time) > feeTimeout) {                                                    // 根据行情的记录时间 和 now 的差值，如果大于 手续费更新周期
                delete feeCache[key];                                                             // 删除 过期的 费率 数据
            } else {
                fee = v.fee;                                                                      // 如果没大于更新周期， 取出v.fee 赋值给 fee
            }
        }
        if (!fee) {                                                                               // 如果没有找到 fee 还是初始的null ， 则触发if 
            while (!(fee = state.details[i].exchange.GetFee())) {                                 // 调用 当前交易所对象 GetFee 函数 获取 费率
                Sleep(Interval);
            }
            feeCache[key] = {fee: fee, time: now};                                                // 在费率缓存 数据结构 feeCache 中储存 获取的 fee 和 当前的时间戳
        }
        // Buy-=fee Sell+=fee
        state.details[i].ticker = {Buy: ticker.Buy * (1-(fee.Sell/100)), Sell: ticker.Sell * (1+(fee.Buy/100))};   // 通过对行情价格处理 得到排除手续费后的 价格用于计算差价
        state.details[i].realTicker = ticker;                                                                      // 实际的 行情价格
        state.details[i].fee = fee;                                                                                // 费率
    }
}

function adjustFloat(v) {                 // 处理数据的自定义函数 ，可以把参数 v 处理 返回 保留3位小数（floor向下取整）
    return Math.floor(v*1000)/1000;       // 先乘1000 让小数位向左移动三位，向下取整 整数，舍去所有小数部分，再除以1000 ， 小数点向右移动三位，即保留三位小数。
}


function test() { 
	var routine = exchange.Go("GetDepth"); // 异步返回一个可以调用wait方法的对像routine 
	var ret = routine.wait(1000); // 等待异步操作结束, 超时为1秒 
	if (typeof(ret) !== 'undefined') { // 只要ret不是undefined就说明异步已经结束并返回了值 
		Log("异步结束", ret); // 此时方法如果失败就返回null，成功就返回需要的值, 与同步返回的值是一样的 
		// 对于一个已经结束了的异步调用, 不能重复wait了, 会造成策略异常退出 !!! 
	} else { 
		Log("超时"); // 只有超时的才可以重新wait 
	}	 
}