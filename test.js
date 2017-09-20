// botvs@881211fe3a34f558ba5cff9593324b37

var Interval = 700;
var TickInterval = 700;
var AmountOnce = 0.2;
var SlideRatio = 10;
var feeCache = new Array();
var SlidePrice = 0.1;
var MaxDiff = 6;
var feeTimeout = 30 * 60000;
var StopWhenLoss = false; 

var transactions = {};
var accounts = {};
var initState;
var lastProfit = 0;                       // 全局变量 记录上次盈亏
var lastAvgPrice = 0;
var lastSpread = 0;
var lastOpAmount = 0;
var isBalance = true;
var transLog = "";

var lastState = null;
var maxRetry = 3;


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

 	// LogReset();
    // LogProfitReset();

    initState = getExchangesState(true);                      // 调用自定义的 getExchangesState 函数获取到 所有交易所的信息， 赋值给 initState 
    if (initState.allStocks == 0) {                       // 如果 所有交易所 币数总和为0  ，抛出错误。
        throw "所有交易所货币数量总和为空, 必须先在任一交易所建仓才可以完成对冲";
    }
    if (initState.allBalance == 0) {                      // 如果 所有交易所 钱数总和为0  ，抛出错误。
        throw "所有交易所CNY数量总和为空, 无法继续对冲";
    }

    for (var i = 0; i < initState.details.length; i++) {  // 遍历获取的交易所状态中的 details数组。
        var e = initState.details[i];                     // 把当前索引的交易所信息赋值给e 
        Log(e.exchange.GetName(), e.exchange.GetCurrency(), e.account);   // 调用e 中引用的 交易所对象的成员函数 GetName ， GetCurrency , 和 当前交易所信息中储存的 账户信息 e.account  用Log 输出。 
    }

    Log("ALL: Balance: ", initState.allBalance, "Stocks: ", initState.allStocks, "Ver:", Version());  // 打印日志 输出 所有添加的交易所的总钱数， 总币数， 托管者版本

 	while (true) {                                        // while 循环
        onTick();                                         // 执行主要 逻辑函数 onTick 
        Sleep(parseInt(TickInterval));
    }
}

function adjustFloat(v) {                 // 处理数据的自定义函数 ，可以把参数 v 处理 返回 保留3位小数（floor向下取整）
    return Math.floor(v*1000)/1000;       // 先乘1000 让小数位向左移动三位，向下取整 整数，舍去所有小数部分，再除以1000 ， 小数点向右移动三位，即保留三位小数。
}

function isPriceNormal(v) {               // 判断是否价格正常， StopPriceL 是跌停值，StopPriceH 是涨停值，在此区间返回 true  ，超过这个 区间 认为价格异常 返回false
    // return (v >= StopPriceL) && (v <= StopPriceH);  // 在此区间
    return true;
}

function setAccount(exchangeName, account, reset) {

	// var initStock = 1.5;
	// var initBalance = 5800;

	var initStock = 0.49;
	var initBalance = 1923;

	if(reset) {
		account.Stocks = initStock;
		account.Balance = initBalance;
		accounts[exchangeName] = {
			"Stocks": initStock,
			"Balance": initBalance
		};
	}else {
		account.Stocks = accounts[exchangeName].Stocks;
		account.Balance = accounts[exchangeName].Balance;
		// Log(exchangeName + ", Stocks: " + account.Stocks + ", Balance: " + account.Balance);
	}

	account.FrozenStocks = 0;
	account.FrozenBalance = 0;
}

function getExchangesState(isInit) {                                      // 获取 交易所状态 函数
    var allStocks = 0;                                              // 所有的币数
    var allBalance = 0;                                             // 所有的钱数
    var minStock = 0;                                               // 最小交易 币数
    var details = [];                                               // details 储存详细内容 的数组。
    for (var i = 0; i < exchanges.length; i++) {                    // 遍历 交易所对象数组
        // var account = null;                                         // 每次 循环声明一个 account 变量。
        // while (!(account = exchanges[i].GetAccount())) {            // 使用exchanges 数组内的 当前索引值的 交易所对象，调用其成员函数，获取当前交易所的账户信息。返回给 account 变量,!account为真则一直获取。
        //     Sleep(Interval);                                        // 如果!account 为真，即account获取失败，则调用Sleep 函数 暂停 Interval 设置的 毫秒数 时间，重新循环，直到获取到有效的账户信息。 
        // }
        var account = {};
        exchanges[i].SetPrecision(2, 5);                            // 设置价格小数位精度为2位, 品种下单量小数位精度为3位
        setAccount(exchanges[i].GetName(), account, isInit);
        allStocks += account.Stocks + account.FrozenStocks;         // 累计所有 交易所币数
        allBalance += account.Balance + account.FrozenBalance;      // 累计所有 交易所钱数
        minStock = Math.max(minStock, exchanges[i].GetMinStock());  // 设置最小交易量minStock  为 所有交易所中 最小交易量最大的值
        details.push({exchange: exchanges[i], account: account});   // 把每个交易所对象 和 账户信息 组合成一个对象压入数组 details 
    }
    return {allStocks: adjustFloat(allStocks), allBalance: adjustFloat(allBalance), minStock: minStock, details: details};   // 返回 所有交易所的 总币数，总钱数 ，所有最小交易量中的最大值， details数组
}

function updateStatePrice(state) {        // 更新 价格
    var now = (new Date()).getTime();     // 记录 当前时间戳
    for (var i = 0; i < state.details.length; i++) {    // 根据传入的参数 state（getExchangesState 函数的返回值），遍历 state.details
        var ticker = null;                              // 声明一个 变量 ticker
        var key = state.details[i].exchange.GetName() + state.details[i].exchange.GetCurrency();  // 获取当前索引 i  的 元素，使用其中引用的交易所对象 exchange ,调用GetName、GetCurrency函数
                                                                                                  // 交易所名称 + 币种 字符串 赋值给 key ，作为键
        var fee = null;                                                                           // 声明一个变量 Fee
        var retryTimes = 0;
        while (!(ticker = state.details[i].exchange.GetTicker()) && retryTimes < maxRetry) {                               // 用当前 交易所对象 调用 GetTicker 函数获取 行情，获取失败，执行循环
        	retryTimes++;
            Sleep(Interval);                                                                      // 执行 Sleep 函数，暂停 Interval 设置的毫秒数            
        }
        //如果获取不到ticker数据，已上次的代替，并标记后继续下一个exchange的设置
        if(retryTimes >= maxRetry && lastState != null) {
        	Log(state.details[i].exchange.GetName() + ": GetTicker重试失败，不参与此次对冲", "@");
        	state.details[i].ticker = lastState.details[i].ticker;
        	state.details[i].realTicker = lastState.details[i].realTicker;
        	state.details[i].fee = lastState.details[i].fee;
        	state.details[i].skip = true;
        	continue;
        }

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
            fee = {
            	"Sell": 0.15,
            	"Buy": 0.15
            };
            feeCache[key] = {fee: fee, time: now};                                                // 在费率缓存 数据结构 feeCache 中储存 获取的 fee 和 当前的时间戳
        }

        //汇率转化
        ticker.Buy = adjustFloat(ticker.Buy/state.details[i].exchange.GetRate());
        ticker.Sell = adjustFloat(ticker.Sell/state.details[i].exchange.GetRate());

        // Buy-=fee Sell+=fee
        state.details[i].ticker = {Buy: ticker.Buy * (1-(fee.Sell/100)), Sell: ticker.Sell * (1+(fee.Buy/100))};   // 通过对行情价格处理 得到排除手续费后的 价格用于计算差价
        // state.details[i].ticker = {Buy: ticker.Buy * (1-(0.15/100)), Sell: ticker.Sell * (1+(0.15/100))};   // 通过对行情价格处理 得到排除手续费后的 价格用于计算差价
        state.details[i].realTicker = ticker;                                                                      // 实际的 行情价格
        state.details[i].fee = fee;     
        // Log(state.details[i].exchange.GetName() + ", Sell: " + fee.Sell + ", Buy: " + fee.Buy);                                                                           // 费率
    }
    lastState = state;
}

function getProfit(stateInit, stateNow, coinPrice) {                // 获取 当前计算盈亏的函数 
    var netNow = stateNow.allBalance + (stateNow.allStocks * coinPrice);          // 计算当前账户的总资产市值
    var netInit =  stateInit.allBalance + (stateInit.allStocks * coinPrice);      // 计算初始账户的总资产市值    
    // Log("stateNow.allBalance :" + stateNow.allBalance + ", stateInit.allBalance: " + stateInit.allBalance);
    LogStatus(" 总资产：" + netNow + ", 币差：" + (stateNow.allStocks - stateInit.allStocks) + "\n" + transLog);
    return adjustFloat(netNow - netInit);                                         // 当前的 减去 初始的  即是 盈亏，return 这个盈亏
}

function balanceAccounts() {          // 平衡交易所 账户 钱数 币数
    // already balance
    if (isBalance) {                  // 如果 isBalance 为真 ， 即 平衡状态，则无需平衡，立即返回
        return;
    }

    // cancelAllOrders();                // 在平衡前 要先取消所有交易所的挂单

    var state = getExchangesState(false);  // 调用 getExchangesState 函数 获取所有交易所状态（包括账户信息）
    var diff = state.allStocks - initState.allStocks;      // 计算当前获取的交易所状态中的 总币数与初始状态总币数 只差（即 初始状态 和 当前的 总币差）
    var adjustDiff = adjustFloat(Math.abs(diff));          // 先调用 Math.abs 计算 diff 的绝对值，再调用自定义函数 adjustFloat 保留3位小数。 
    if (adjustDiff < state.minStock) {                     // 如果 处理后的 总币差数据 小于 满足所有交易所最小交易量的数据 minStock，即不满足平衡条件
        isBalance = true;                                  // 设置 isBalance 为 true ,即平衡状态
    } else {                                               //  adjustDiff >= state.minStock  的情况 则：
        Log('初始币总数量:', initState.allStocks, '现在币总数量: ', state.allStocks, '差额:', adjustDiff);
        // 输出要平衡的信息。
        // other ways, diff is 0.012, bug A only has 0.006 B only has 0.006, all less then minstock
        // we try to statistical orders count to recognition this situation
        updateStatePrice(state);                           // 更新 ，并获取 各个交易所行情
        var details = state.details;                       // 取出 state.details 赋值给 details
        var ordersCount = 0;                               // 声明一个变量 用来记录订单的数量
        if (diff > 0) {                                    // 判断 币差 是否大于 0 ， 即 是否是 多币。卖掉多余的币。
            var attr = 'Sell';                             // 默认 设置 即将获取的 ticker 属性为 Sell  ，即 卖一价
            if (UseMarketOrder) {                          // 如果 设置 为 使用市价单， 则 设置 ticker 要获取的属性 为 Buy 。（通过给atrr赋值实现）
                attr = 'Buy';
            }
            // Sell adjustDiff, sort by price high to low
            details.sort(function(a, b) {return b.ticker[attr] - a.ticker[attr];}); // return 大于0，则 b 在前，a在后， return 小于0 则 a 在前 b在后，数组中元素，按照 冒泡排序进行。
                                                                                    // 此处 使用 b - a ，进行排序就是 details 数组 从高到低排。
            for (var i = 0; i < details.length && adjustDiff >= state.minStock; i++) {     // 遍历 details 数组 
                if (isPriceNormal(details[i].ticker[attr]) && (details[i].account.Stocks >= state.minStock)) {    // 判断 价格是否异常， 并且 当前账户币数是否大于最小可以交易量
                    var orderAmount = adjustFloat(Math.min(AmountOnce, adjustDiff, details[i].account.Stocks));
                    // 给下单量 orderAmount 赋值 ， 取 AmountOnce 单笔交易数量， 币差 ， 当前交易所 账户 币数 中的 最小的。   因为details已经排序过，开始的是价格最高的，这样就是从最高的交易所开始出售
                    var orderPrice = details[i].realTicker[attr] - SlidePrice;               // 根据 实际的行情价格（具体用卖一价Sell 还是 买一价Buy 要看UseMarketOrder的设置了）
                                                                                             // 因为是要下卖出单 ，减去滑价 SlidePrice 。设置好下单价格
                    if ((orderPrice * orderAmount) < details[i].exchange.GetMinPrice()) {    // 判断 当前索引的交易所的最小交易额度 是否 足够本次下单的 金额。
                        continue;                                                            // 如果小于 则 跳过 执行下一个索引。
                    }
                    ordersCount++;                                                           // 订单数量 计数 加1
                    // if (details[i].exchange.Sell(orderPrice, orderAmount, stripTicker(details[i].ticker))) {   // 按照 以上程序既定的 价格 和 交易量 下单, 并且输出 排除手续费因素后处理过的行情数据。
                    //     adjustDiff = adjustFloat(adjustDiff - orderAmount);                  // 如果 下单API 返回订单ID ， 根据本次既定下单量更新 未平衡的量
                    // }
                    doSell(details[i].exchange, orderPrice, orderAmount);
                    adjustDiff = adjustFloat(adjustDiff - orderAmount);
                    // only operate one platform                                             // 只在一个平台 操作平衡，所以 以下 break 跳出本层for循环
                    break;
                }
            }
        } else {                                           // 如果 币差 小于0 ， 即 缺币  要进行补币操作
            var attr = 'Buy';                              // 同上
            if (UseMarketOrder) {
                attr = 'Sell';
            }
            // Buy adjustDiff, sort by sell-price low to high
            details.sort(function(a, b) {return a.ticker[attr] - b.ticker[attr];});           // 价格从小到大 排序，因为从价格最低的交易所 补币
            for (var i = 0; i < details.length && adjustDiff >= state.minStock; i++) {        // 循环 从价格小的开始
                if (isPriceNormal(details[i].ticker[attr])) {                                 // 如果价格正常 则执行  if {} 内代码
                    var canRealBuy = adjustFloat(details[i].account.Balance / (details[i].ticker[attr] + SlidePrice));
                    var needRealBuy = Math.min(AmountOnce, adjustDiff, canRealBuy);
                    var orderAmount = adjustFloat(needRealBuy * (1+(details[i].fee.Buy/100)));  // 因为买入扣除的手续费 是 币数，所以 要把手续费计算在内。
                    var orderPrice = details[i].realTicker[attr] + SlidePrice;
                    if ((orderAmount < details[i].exchange.GetMinStock()) ||
                        ((orderPrice * orderAmount) < details[i].exchange.GetMinPrice())) {
                        continue;
                    }
                    ordersCount++;
                    // if (details[i].exchange.Buy(orderPrice, orderAmount, stripTicker(details[i].ticker))) {
                    //     adjustDiff = adjustFloat(adjustDiff - needRealBuy);
                    // }
                    doBuy(details[i].exchange, orderPrice, orderAmount);
                    adjustDiff = adjustFloat(adjustDiff - needRealBuy);
                    // only operate one platform
                    break;
                }
            }
        }
        isBalance = (ordersCount == 0);                                                         // 是否 平衡， ordersCount  为 0 则 ，true
    }

    if (isBalance) {
        var currentProfit = getProfit(initState, state, lastAvgPrice);                          // 计算当前收益
        LogProfit(currentProfit, "Spread: ", adjustFloat((currentProfit - lastProfit) / lastOpAmount), "Balance: ", adjustFloat(state.allBalance), "Stocks: ", adjustFloat(state.allStocks));
        // 打印当前收益信息
        if (StopWhenLoss && currentProfit < 0 && Math.abs(currentProfit) > MaxLoss) {           // 超过最大亏损停止代码块
            Log('交易亏损超过最大限度, 程序取消所有订单后退出.');
            // cancelAllOrders();                                                                  // 取消所有 挂单
            if (SMSAPI.length > 10 && SMSAPI.indexOf('http') == 0) {                            // 短信通知 代码块
                HttpQuery(SMSAPI);
                Log('已经短信通知');
            }
            throw '已停止';                                                                      // 抛出异常 停止策略
        }
        lastProfit = currentProfit;                                                             // 用当前盈亏数值 更新 上次盈亏记录
    }
}

function onTick() {                  // 主要循环
    if (!isBalance) {                // 判断 全局变量 isBalance 是否为 false  (代表不平衡)， !isBalance 为 真，执行 if 语句内代码。
        balanceAccounts();           // 不平衡 时执行 平衡账户函数 balanceAccounts()
        return;                      // 执行完返回。继续下次循环执行 onTick
    }

    var state = getExchangesState(false); // 获取 所有交易所的状态
    
    // We also need details of price
    updateStatePrice(state);         // 更新 价格， 计算排除手续费影响的对冲价格值

    var details = state.details;     // 取出 state 中的 details 值
    var maxPair = null;              // 最大   组合
    var minPair = null;              // 最小   组合
    for (var i = 0; i < details.length; i++) {      //  遍历 details 这个数组    

    	//忽略没有得到数据的exchange
    	if(details[i].skip) {
    		continue;
    	}

        var sellOrderPrice = details[i].account.Stocks * (details[i].realTicker.Buy - SlidePrice);    // 计算 当前索引 交易所 账户币数 卖出的总额（卖出价为对手买一减去滑价）
        if (((!maxPair) || (details[i].ticker.Buy > maxPair.ticker.Buy)) && (details[i].account.Stocks >= state.minStock) &&
            (sellOrderPrice > details[i].exchange.GetMinPrice())) { // 首先判断maxPair 是不是 null ，如果不是null 就判断 排除手续费因素后的价格 大于 maxPair中行情数据的买一价
                                                                    // 剩下的条件 是 要满足最小可交易量，并且要满足最小交易金额，满足条件执行以下。
            details[i].canSell = details[i].account.Stocks;         // 给当前索引的 details 数组的元素 增加一个属性 canSell 把 当前索引交易所的账户 币数 赋值给它
            maxPair = details[i];                                   // 把当前的 details 数组元素 引用给 maxPair 用于 for 循环下次对比，对比出最大的价格的。
        }

        // if (((!maxPair) || (details[i].ticker.Buy > maxPair.ticker.Buy))) { // 首先判断maxPair 是不是 null ，如果不是null 就判断 排除手续费因素后的价格 大于 maxPair中行情数据的买一价
        //                                                             // 剩下的条件 是 要满足最小可交易量，并且要满足最小交易金额，满足条件执行以下。
        //     details[i].canSell = details[i].account.Stocks;         // 给当前索引的 details 数组的元素 增加一个属性 canSell 把 当前索引交易所的账户 币数 赋值给它
        //     maxPair = details[i];                                   // 把当前的 details 数组元素 引用给 maxPair 用于 for 循环下次对比，对比出最大的价格的。
        // }

        var canBuy = adjustFloat(details[i].account.Balance / (details[i].realTicker.Sell + SlidePrice));   // 计算 当前索引的 交易所的账户资金 可买入的币数
        var buyOrderPrice = canBuy * (details[i].realTicker.Sell + SlidePrice);                             // 计算 下单金额
        if (((!minPair) || (details[i].ticker.Sell < minPair.ticker.Sell)) && (canBuy >= state.minStock) && // 和卖出 部分寻找 最大价格maxPair一样，这里寻找最小价格
            (buyOrderPrice > details[i].exchange.GetMinPrice())) {
            details[i].canBuy = canBuy;                             // 增加 canBuy 属性记录   canBuy
            // how much coins we real got with fee                  // 以下要计算 买入时 收取手续费后 （买入收取的手续费是扣币）， 实际要购买的币数。
            details[i].realBuy = adjustFloat(details[i].account.Balance / (details[i].ticker.Sell + SlidePrice));   // 使用 排除手续费影响的价格 计算真实要买入的量
            minPair = details[i];                                   // 符合条件的 记录为最小价格组合 minPair
        }

        // if (((!minPair) || (details[i].ticker.Sell < minPair.ticker.Sell))) {
        //     details[i].canBuy = canBuy;                             // 增加 canBuy 属性记录   canBuy
        //     // how much coins we real got with fee                  // 以下要计算 买入时 收取手续费后 （买入收取的手续费是扣币）， 实际要购买的币数。
        //     details[i].realBuy = adjustFloat(details[i].account.Balance / (details[i].ticker.Sell + SlidePrice));   // 使用 排除手续费影响的价格 计算真实要买入的量
        //     minPair = details[i];                                   // 符合条件的 记录为最小价格组合 minPair
        // }
        // Log(details[i].exchange.GetName() + ", Buy: " + details[i].ticker.Buy + ", Sell: " + details[i].ticker.Sell + ", Stocks: " + details[i].account.Stocks + ", sellOrderPrice: " + sellOrderPrice + ", buyOrderPrice: " + buyOrderPrice + ", canBuy: " + canBuy);
        // Log(details[i].exchange.GetName() + ", " + details[i].exchange.GetRate() +  ", Buy: " + details[i].ticker.Buy + ", Sell: " + details[i].ticker.Sell + ", Stocks: " + details[i].account.Stocks + ", Balance: " + details[i].account.Balance);
    }

    // Log("maxPair: " + maxPair.exchange.GetName() + ", minPair: " + minPair.exchange.GetName());
    // Log("maxPair.ticker.Buy: " + maxPair.ticker.Buy + ", maxPair.ticker.Sell: " + maxPair.ticker.Sell);
    // Log("minPair.ticker.Buy: " + minPair.ticker.Buy + ", minPair.ticker.Sell: " + minPair.ticker.Sell);

	// if(maxPair) Log("maxPair: " + maxPair.exchange.GetName() + ", Buy: " + maxPair.ticker.Buy + ", Sell: " + maxPair.ticker.Sell);
	// if(minPair) Log("minPair: " + minPair.exchange.GetName() + ", Buy: " + minPair.ticker.Buy + ", Sell: " + minPair.ticker.Sell);

    if ((!maxPair) || (!minPair) || ((maxPair.ticker.Buy - minPair.ticker.Sell) < MaxDiff) ||         // 根据以上 对比出的所有交易所中最小、最大价格，检测是否不符合对冲条件
    !isPriceNormal(maxPair.ticker.Buy) || !isPriceNormal(minPair.ticker.Sell)) {
        // Log("不满足对冲条件：对冲价格偏差小于MaxDiff (" + MaxDiff + "), 差值: " + (maxPair.ticker.Buy - minPair.ticker.Sell));
        return;                                                                                       // 如果不符合 则返回
    }

    // filter invalid price
    if (minPair.realTicker.Sell <= minPair.realTicker.Buy || maxPair.realTicker.Sell <= maxPair.realTicker.Buy) {   // 过滤 无效价格， 比如 卖一价 是不可能小于等于 买一价的。
        // Log("不满足对冲条件：市场价格异常");
        return;
    }

    // what a fuck...
    if (maxPair.exchange.GetName() == minPair.exchange.GetName()) {                                   // 数据异常，同时 最低 最高都是一个交易所。
        // Log("不满足对冲条件：最大最小为同一市场");
        return;
    }

    lastAvgPrice = adjustFloat((minPair.realTicker.Buy + maxPair.realTicker.Buy) / 2);                // 记录下 最高价  最低价 的平均值
    lastSpread = adjustFloat((maxPair.realTicker.Sell - minPair.realTicker.Buy) / 2);                 // 记录  买卖 差价

    // compute amount                                                                                 // 计算下单量
    var amount = Math.min(AmountOnce, maxPair.canSell, minPair.realBuy);                          // 根据这几个 量取最小值，用作下单量
    // Log("maxPair.canSell: " + maxPair.canSell + ", minPair.realBuy: " + minPair.realBuy);
    lastOpAmount = amount;                                                                            // 记录 下单量到 全局变量
    var hedgePrice = adjustFloat((maxPair.realTicker.Buy - minPair.realTicker.Sell) / Math.max(SlideRatio, 2))  // 根据 滑价系数 ，计算对冲 滑价  hedgePrice
    // Log('买进：', minPair.exchange.GetName() + '(可买进数量：' + minPair.realBuy + ' )' + '，卖出：', maxPair.exchange.GetName() + '(可卖出数量：' + maxPair.canSell + ' )');
    // Log("对冲数量：" + hedgePrice);
    // Log(minPair.exchange.GetName() + '：实际买进数量：' + (minPair.realTicker.Sell + hedgePrice) + ', ' + maxPair.exchange.GetName() + '实际卖出数量：' + (maxPair.realTicker.Buy - hedgePrice));    
    
    // if (minPair.exchange.Buy(minPair.realTicker.Sell + hedgePrice, amount * (1+(minPair.fee.Buy/100)), stripTicker(minPair.realTicker))) { // 先下 买单
    //     maxPair.exchange.Sell(maxPair.realTicker.Buy - hedgePrice, amount, stripTicker(maxPair.realTicker));                               // 买单下之后 下卖单
    // }

    doTransaction(maxPair, minPair, amount, hedgePrice);

    isBalance = false;                                                                                // 设置为 不平衡，下次带检查 平衡。
}

function doBuy(minPair, price, amount) {
	// Log("doBuy");
	// Log("accounts: " + accounts);
	// Log("exchange.GetName(): " + exchange.GetName());

 //    for(var k in accounts) {
 //    	Log(k + ": " + accounts[k] + " , Stocks: " + accounts[k].Stocks);
 //    }

	// Log("accounts[exchange.GetName()]: " + accounts[exchange.GetName()]);
	// Log("accounts[exchange.GetName().Stocks]: " + accounts[exchange.GetName()].Stocks);


	var actualAmount = amount * (1+(minPair.fee.Buy/100));

	accounts[minPair.exchange.GetName()].Stocks += amount;
	accounts[minPair.exchange.GetName()].Balance -= price * amount * (1+(minPair.fee.Buy/100));

	Log("Buy: " + minPair.exchange.GetName() + ", " + price + " ," + actualAmount); 
}

function doSell(maxPair, price, amount) {
	// Log("doSell");
	accounts[maxPair.exchange.GetName()].Stocks -= amount;
	accounts[maxPair.exchange.GetName()].Balance += price * amount * (1-(maxPair.fee.Sell/100));

	Log("Sell: " + maxPair.exchange.GetName() + ", " + price + " ," + amount); 
}


function doTransaction(maxPair, minPair, amount, hedgePrice) {

	// Log("minPair: " + minPair);
	// Log("maxPair: " + maxPair);
	// Log("amount: " + amount);
	// Log("hedgePrice: " + hedgePrice);

	doBuy(minPair, minPair.realTicker.Sell + hedgePrice, amount);

	doSell(maxPair, maxPair.realTicker.Buy - hedgePrice, amount);

	// if (minPair.exchange.Buy(minPair.realTicker.Sell + hedgePrice, amount * (1+(minPair.fee.Buy/100)), stripTicker(minPair.realTicker))) { // 先下 买单
 //        maxPair.exchange.Sell(maxPair.realTicker.Buy - hedgePrice, amount, stripTicker(maxPair.realTicker));                               // 买单下之后 下卖单
 //    }

	var key = maxPair.exchange.GetName() + " -> " + minPair.exchange.GetName();

	if (key in transactions) {   

		var lastCount = transactions[key];

		transactions[key] = lastCount + 1;

    }else {
    	transactions[key] = 1;
    }

    var result = "";

    for(var k in transactions) {
    	result = result + k + ": " + transactions[k] + "\n";
    }

    transLog = result;

    // LogStatus(result);

	// LogStatus("成功匹配" + "maxPair: " + maxPair.exchange.GetName() + ", Buy: " + maxPair.ticker.Buy + ", Sell: " + maxPair.ticker.Sell + ", minPair: " + minPair.exchange.GetName() + ", Buy: " + minPair.ticker.Buy + ", Sell: " + minPair.ticker.Sell);

	// Log("*********************");
    // Log("成功匹配");
    // Log("transactions size: " + size);
    // Log("transactions: " + transactions);
	//    Log("maxPair: " + maxPair.exchange.GetName() + ", Buy: " + maxPair.ticker.Buy + ", Sell: " + maxPair.ticker.Sell);
	// Log("minPair: " + minPair.exchange.GetName() + ", Buy: " + minPair.ticker.Buy + ", Sell: " + minPair.ticker.Sell);

	// Log("Buy: " + minPair.exchange.GetName() + ", " + (minPair.realTicker.Sell + hedgePrice) + " ," + (amount * (1+(minPair.fee.Buy/100))) + ", " + stripTicker(minPair.realTicker)); 
	// Log("Sell: " + maxPair.exchange.GetName() + ", " + (maxPair.realTicker.Buy - hedgePrice) + " ," + (amount) + ", " + stripTicker(maxPair.realTicker)); 

	// if (minPair.exchange.Buy(minPair.realTicker.Sell + hedgePrice, amount * (1+(minPair.fee.Buy/100)), stripTicker(minPair.realTicker))) { // 先下 买单
 //        maxPair.exchange.Sell(maxPair.realTicker.Buy - hedgePrice, amount, stripTicker(maxPair.realTicker));                               // 买单下之后 下卖单
 //    }
	Log("******************************************");
}

function stripTicker(t) {                           // 根据参数 t ， 格式化 输出关于t的数据。
    return 'Buy: ' + adjustFloat(t.Buy) + ' Sell: ' + adjustFloat(t.Sell);
}

function onTick1() {

	// var tickers = [];

	for (var i = 0; i < exchanges.length; i++) {                    // 遍历 交易所对象数组

		var ticker = null;                              // 声明一个 变量 ticker

		while (!(ticker = exchanges[i].GetTicker())) {                               // 用当前 交易所对象 调用 GetTicker 函数获取 行情，获取失败，执行循环
	        Sleep(Interval);                                                                      // 执行 Sleep 函数，暂停 Interval 设置的毫秒数
	    }

        Log(exchanges[i].GetName() + ", Buy: " + ticker.Buy + ", Sell: " + ticker.Sell);
    }
}