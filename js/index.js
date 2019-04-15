let musicRender = function(){
    let $headerBox = $('.headerBox'),
        $img_bg = $('.img_bg');
        $detail = $('.detail'),
        $portrait = $('.portrait'),
        $rightBox = $('.rightBox'),
        $contentBox = $('.contentBox'),
        $wrapper = $contentBox.find('.wrapper'),
        $footerBox = $('.footerBox'),
        $progress = $('.progress'),
        $progressing = $('.progressing'),
        $currentTime = $progress.find('.currentTime'),
        $durationTime = $progress.find('.durationTime'),
        $nextMusic = $('.nextMusic'),
        $nextLink = $nextMusic.find('a'),
        $audioMusic = $('.audioMusic'),
        audioMusic = null;
        $pLyricList = null;

    let currentPageId = 2, //当前歌曲的ID
        isBind = false,
        isBind2 = false;

    function computedContentHeight(){
        let win = document.documentElement.clientHeight,
            fonSize = document.documentElement.style.fontSize,
            margin = parseFloat($contentBox.css('margin-top'));
        let height = win - parseFloat($headerBox[0].offsetHeight) - parseFloat($footerBox[0].offsetHeight) - margin * 2;
        $contentBox.css('height', height);
    }

    function queryLyric(){
        return new Promise(resolve =>{
            //这里写异步方法
            $.ajax({
                url: 'json/music.json',
                method: 'get',
                dataType: 'json',
                success: resolve
            })
        })
    }

    function bindHTML(data){
        let {title, author, lyric, portrait, music} = data; //进行对象结构，提出我们需要的变量
        //绑定歌名和作者
        let detailStr = `<h2 class="title">${title}</h2>   
                        <h3 class="author">${author}</h3>`,
            portraitStr = `<img src="${portrait}" alt="">`, //绑定歌手写真
            musicStr = `<audio src="${music}" preload="none" id="audioMusic"></audio`, //绑定音乐
            lyricStr = ``; //绑定歌词

        lyric.forEach(item => {
            let {minutes, seconds, content} = item;
            lyricStr += `<p data-minutes="${minutes}" data-seconds="${seconds}" >${content}</p>`;
        });
        $img_bg.html(portraitStr);
        $portrait.html(portraitStr);
        $detail.html(detailStr);
        $wrapper.html(lyricStr);
        $audioMusic.html(musicStr);

        //得到p集合
        $pLyricList = $wrapper.find('p');
        //得到audio标签
        audioMusic = $('#audioMusic')[0];
    }

    /**
     * 利用发布订阅的设计思想，将资源加载完成后要做的事情全部都加进计划列表里，在需要执行的时候按照顺序执行
     * */
    let $plan = $.Callbacks();
    function playRun(){
        //开启音乐播放功能
        audioMusic.play();
        //当音乐资源可以播放的时候，再将计划表中的计划一一执行
        audioMusic.addEventListener('canplay', $plan.fire);
    }

    /**
     * 添加计划
     */

    //播放歌曲和暂停歌曲
    $plan.add(() => {
        //显示头部的图标
        $rightBox.css('display', 'block').addClass('move');
        //绑定点击事件
        if(!isBind){ //保证只绑定一次
            $rightBox.tap(() => {
                if(audioMusic.paused){ //当前音乐已经暂停播放
                    audioMusic.play();
                    $rightBox.addClass('move');
                }else{
                    audioMusic.pause();
                    $rightBox.removeClass('move');
                }
            });
            isBind = true;
        }
    });
    //控制进度条
    let autoTimer = null;
    $plan.add(() => {
        let durationTime = audioMusic.duration; //获取音乐的总时长 (单位是秒)
        $durationTime.html(computedTime(durationTime));

        autoTimer = window.setInterval(() => {
            let currentTime = audioMusic.currentTime;
            $currentTime.html(computedTime(currentTime));
            if(currentTime > durationTime){ //播放完毕
                window.clearTimeout(autoTimer);
                $currentTime.html(computedTime(duration));
                $progressing.css('width', '100%');
                $rightBox.removeClass('move');
                return;
            }
            //正在播放
            $progressing.css('width',currentTime / durationTime * 100 + '%');
            lyricsCorresponding(computedTime(currentTime));
        }, 1000);
    });
    //歌词对应
    let translateY = 0; //当前wrapper移动的距离
    function lyricsCorresponding(time){
        let [minutes, seconds] = time.split(':');
        //从$pLyricList集合中过滤出我们需要的
        let $matchList = $pLyricList.filter(`[data-minutes="${minutes}"]`).filter(`[data-seconds="${seconds}"]`);
        if($matchList.length === 0) return;
        //当前歌词已经被选中了(例如：这句歌词可能需要五秒才能播放完成，我们定时器监听五次，第一次设置后，后面四次不需要重新设置了)
        if($matchList.hasClass('active')) return;
        $matchList.addClass('active').siblings().removeClass('active');
        let index = $matchList.index();
        if(index >= 4){
            //=>已经对应超过四条歌词了,接下来每当对应一条都让WRAPPER向上移动一行
            let offsetHeight = $matchList[0].offsetHeight;
            translateY -= offsetHeight;
            $wrapper.css('transform', `translateY(${translateY}px)`);
        }
    }

    //将以秒为单位的时间转换为以分钟和秒表示的时间
    function computedTime(time){
        let minutes = Math.floor(time / 60),
            seconds = Math.floor(time - minutes * 60);
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        return `${minutes}:${seconds}`;
    }

    function changeMusic(){
        audioMusic.pause();
        $wrapper.css('transform', 'translateY(0px)');
        ++currentPageId;
        currentPageId = currentPageId > 2 ? 0 : currentPageId;
        //初始化数据
        translateY = 0;
        $rightBox.css('display', 'none');
        musicRender.init();
    }
    return {
        init: function init(){
            //动态计算content区域的高度
            computedContentHeight();

            //获取Promise的实例
            let promise = queryLyric(),
                lyricAry = [];

            promise.then( result => {//数据请求成功执行的第一个方法
                //进行歌词的第一次格式化处理
                result.forEach((item, index)=> {
                    let {lyric = ''} = item,
                        reg = /\[(\d+):(\d+).\d+\](.+)/g; //.匹配除换行符之外的所有符号
                    //[00:00.29]魏潇逸、丁倩倩 - 陌生人(Live)
                    lyric.replace(reg, (...arg) => {
                        let [, minutes, seconds, content] = arg;
                        lyricAry.push({
                            minutes,
                            seconds,
                            content
                        });
                    });
                    result[index]["lyric"] = lyricAry;
                    lyricAry = []; //每一次都要清空
                });
                return result;
            }).then((dataSource) => {
                let currentMusic = dataSource[currentPageId]; //根据歌曲ID得到歌曲信息
                //绑定歌曲信息
                bindHTML(currentMusic);
            }).then(playRun).then(()=>{
                audioMusic.addEventListener('ended', changeMusic);
            });

            //绑定下一首歌曲歌曲的点击事件
            if(!isBind2){
                $nextLink.tap(changeMusic);
                isBind2 = true;
            }
        }
    }
}();
musicRender.init();
