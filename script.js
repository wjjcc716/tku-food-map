let allRestaurants = [];
let displayedRestaurants = [];
let showOnlyOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    fetch('restaurants.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response failure');
            return response.json();
        })
        .then(data => {
            // 🎲 每次重新整理網頁時，隨機打亂餐廳順序（Fisher-Yates Shuffle）
            allRestaurants = shuffleArray(data);
            displayedRestaurants = [...allRestaurants];

            renderRestaurants(displayedRestaurants);
            setupCategoryButtons();
            setupRoadButtons();
            setupSearchInput();
            setupSmartFilter();
            setupRandomPicker();
            setupOpenStatusToggle();
        })
        .catch(error => {
            console.error('無法載入 restaurants.json:', error);
            const container = document.getElementById('restaurant-list');
            if (container) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-warning d-inline-block px-4">
                            ⚠️ 載入店家資料失敗，請確認 restaurants.json 檔案是否存在。
                        </div>
                    </div>`;
            }
        });
});

// 陣列隨機洗牌函式
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ⏰ 精確判斷「現在是否營業中」（考慮星期幾、午休時間、跨夜）
function isOpenNow(item) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 是週日, 1-6 是週一至週六
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. 若有 Google 官方結構化 periods 資料，優先用極精確判斷
    if (item.periods && item.periods.length > 0) {
        for (let period of item.periods) {
            if (!period.open) continue;

            const openDay = period.open.day;
            const openHour = period.open.hour || 0;
            const openMinute = period.open.minute || 0;
            const openTimeMin = openHour * 60 + openMinute;

            // 24 小時營業
            if (!period.close && openDay === currentDay && openHour === 0) return true;

            if (period.close) {
                const closeDay = period.close.day;
                const closeHour = period.close.hour || 0;
                const closeMinute = period.close.minute || 0;
                let closeTimeMin = closeHour * 60 + closeMinute;

                // 同一天內的時段
                if (openDay === currentDay && closeDay === currentDay) {
                    if (currentMinutes >= openTimeMin && currentMinutes <= closeTimeMin) {
                        return true;
                    }
                }
                // 跨夜時段（例如 18:00 開到隔天 02:00）
                else if (openDay === currentDay) {
                    closeTimeMin += 24 * 60;
                    if (currentMinutes >= openTimeMin && currentMinutes <= closeTimeMin) {
                        return true;
                    }
                } else if (closeDay === currentDay) {
                    // 昨天跨到今天清晨的時段
                    if (currentMinutes <= closeTimeMin) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // 2. 文字備援解析邏輯
    const hoursStr = item.hours || "";
    if (hoursStr.includes("24小時")) return true;
    if (hoursStr.includes("休息") || hoursStr.includes("公休")) return false;

    const ranges = hoursStr.split(',');
    for (let range of ranges) {
        const times = range.split('-').map(t => t.trim());
        if (times.length !== 2) continue;

        const parseMinutes = (tStr) => {
            const m = tStr.match(/(\d{1,2}):(\d{2})/);
            if (!m) return -1;
            return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        };

        const startM = parseMinutes(times[0]);
        let endM = parseMinutes(times[1]);
        if (startM === -1 || endM === -1) continue;

        if (endM < startM) endM += 24 * 60;

        if (currentMinutes >= startM && currentMinutes <= endM) {
            return true;
        }
    }

    return false;
}

// 🌙 精確判斷是否為「真·宵夜」店家（營業超過深夜 22:00 或跨夜至凌晨）
function isLateNightFood(item) {
    if (item.category && item.category.includes("宵夜")) return true;

    if (item.periods && item.periods.length > 0) {
        for (let period of item.periods) {
            if (period.close) {
                const closeHour = period.close.hour;
                // 打烊時間大於等於 22 點，或是在凌晨 0~5 點之間打烊
                if (closeHour >= 22 || closeHour <= 5) return true;
            }
        }
    }

    const hoursStr = item.hours || "";
    if (hoursStr.includes("24小時")) return true;
    
    // 檢查字串中是否有 22:00, 23:00, 24:00, 01:00, 02:00 等宵夜時間
    const nightRegex = /(2[2-9]|0[0-5]):\d{2}/;
    return nightRegex.test(hoursStr);
}

// 渲染卡片列表
function renderRestaurants(list) {
    const container = document.getElementById('restaurant-list');
    const countDisplay = document.getElementById('restaurant-count');
    if (!container) return;

    let displayList = list;
    if (showOnlyOpen) {
        displayList = list.filter(item => isOpenNow(item));
    }

    if (countDisplay) {
        countDisplay.textContent = `共找到 ${displayList.length} 家淡江美食`;
    }

    if (!displayList || displayList.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="fs-5 text-muted">😢 找不到符合條件的店家（可能目前時間非營業時間），試試切換區域或關閉「只看營業中」！</p>
            </div>`;
        return;
    }

    container.innerHTML = displayList.map(item => {
        const rating = item.rating || "4.0";
        const reviewCount = item.reviewCount || 0;
        const address = item.address || '淡江大學周邊';
        const hours = item.hours || '11:00 - 20:30';
        const openStatus = isOpenNow(item);
        const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + address)}`;

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm border-0 rounded-3 hover-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-primary fs-6 px-2 py-1">${item.road || '周邊商圈'}</span>
                            <span class="text-warning fw-bold">★ ${rating} <small class="text-muted">(${reviewCount})</small></span>
                        </div>
                        <h5 class="card-title fw-bold text-dark mb-2">${item.name}</h5>
                        <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                            <span class="badge ${openStatus ? 'bg-success' : 'bg-secondary'} px-2 py-1">
                                ${openStatus ? '🟢 營業中' : '🔴 休息中'}
                            </span>
                            <span class="badge bg-light text-dark border">${item.category || '美食'}</span>
                            ${item.isPopular ? '<span class="badge bg-danger">🔥 超人氣</span>' : ''}
                        </div>
                        <p class="card-text text-secondary fs-7 mb-1">${item.intro || '淡江學生熱門用餐選擇'}</p>
                        <p class="text-muted small mb-1">🕒 營業時間：${hours}</p>
                        <p class="text-muted small mb-0">📍 ${address}</p>
                    </div>
                    <div class="card-footer bg-white border-0 pt-0 pb-3">
                        <a href="${googleMapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold">
                            🗺️ 在 Google 地圖開啟
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 切換只看營業中
function setupOpenStatusToggle() {
    const toggleBtn = document.getElementById('open-only-btn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        showOnlyOpen = !showOnlyOpen;
        if (showOnlyOpen) {
            toggleBtn.classList.remove('btn-outline-success');
            toggleBtn.classList.add('btn-success', 'active');
            toggleBtn.textContent = '🟢 已篩選：只看營業中';
        } else {
            toggleBtn.classList.remove('btn-success', 'active');
            toggleBtn.classList.add('btn-outline-success');
            toggleBtn.textContent = '🟢 只看營業中';
        }
        renderRestaurants(displayedRestaurants);
    });
}

// 🎲 隨機抽獎（支援：指定區域 / 全部區域隨機抽）
function setupRandomPicker() {
    const startBtn = document.getElementById('start-roll-btn');
    const slotDisplay = document.getElementById('slot-machine');
    const resultCard = document.getElementById('random-result-card');
    const roadSelect = document.getElementById('random-road-select');

    if (!startBtn) return;

    startBtn.addEventListener('click', () => {
        const selectedRoad = roadSelect ? roadSelect.value : 'ALL';
        
        // 根據選擇的路段過濾可抽取店家池
        let candidateList = allRestaurants;
        if (selectedRoad !== 'ALL') {
            candidateList = allRestaurants.filter(item => {
                const addr = item.address || '';
                const r = item.road || '';
                if (selectedRoad === '學府路') return addr.includes('學府路') || r.includes('學府路');
                if (selectedRoad === '大學城') return r.includes('大學城') || addr.includes('學府路') || addr.includes('182巷');
                return r.includes(selectedRoad) || addr.includes(selectedRoad);
            });
        }

        if (candidateList.length === 0) {
            alert('⚠️ 該區域目前沒有可抽取的店家，請選擇其他區域！');
            return;
        }

        startBtn.disabled = true;
        resultCard.classList.add('d-none');
        slotDisplay.classList.remove('d-none');

        let counter = 0;
        const speed = 50;
        const totalRolls = 20;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * candidateList.length);
            slotDisplay.textContent = candidateList[randomIndex].name;
            counter++;

            if (counter >= totalRolls) {
                clearInterval(interval);
                
                const winner = candidateList[Math.floor(Math.random() * candidateList.length)];
                slotDisplay.classList.add('d-none');
                resultCard.classList.remove('d-none');

                const rating = winner.rating || "4.0";
                const address = winner.address || '淡江大學周邊';
                const openStatus = isOpenNow(winner);
                const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winner.name + ' ' + address)}`;

                resultCard.innerHTML = `
                    <div class="card border-2 border-danger shadow-sm rounded-4 p-3 text-start">
                        <div class="text-center mb-2">
                            <span class="badge bg-danger fs-6 mb-1">🎉 命運決定是你了！</span>
                            <h3 class="fw-bold text-dark mt-1">${winner.name}</h3>
                        </div>
                        <p class="mb-1"><strong>📍 位置：</strong>${winner.road}（${address}）</p>
                        <p class="mb-1"><strong>🕒 狀態：</strong>${openStatus ? '🟢 目前營業中' : '🔴 目前休息中'} (${winner.hours})</p>
                        <p class="mb-1"><strong>⭐ 評分：</strong>${rating} ★</p>
                        <p class="text-secondary small mb-3">${winner.intro}</p>
                        <a href="${googleMapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-danger w-100 rounded-pill fw-bold">
                            🗺️ 立刻出發！開啟地圖導航
                        </a>
                    </div>
                `;

                startBtn.disabled = false;
                startBtn.textContent = '🔄 再抽一次！';
            }
        }, speed);
    });
}

// 美食種類篩選（正確處理宵夜）
function setupCategoryButtons() {
    const catBtns = document.querySelectorAll('.category-btn');
    if (!catBtns.length) return;

    catBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            catBtns.forEach(b => b.classList.remove('active', 'btn-dark'));
            e.target.classList.add('active', 'btn-dark');

            const cat = e.target.dataset.category;
            if (cat === '全部') {
                displayedRestaurants = [...allRestaurants];
            } else if (cat === '宵夜') {
                // 🎯 宵夜改為精準時間判斷，不再誤將 20:00 關門的店放進來！
                displayedRestaurants = allRestaurants.filter(item => isLateNightFood(item));
            } else {
                displayedRestaurants = allRestaurants.filter(item => {
                    const categoryMatch = (item.category || '').includes(cat);
                    const nameMatch = (item.name || '').includes(cat);
                    const introMatch = (item.intro || '').includes(cat);
                    return categoryMatch || nameMatch || introMatch;
                });
            }
            renderRestaurants(displayedRestaurants);
        });
    });
}

// 路段按鈕點擊篩選
function setupRoadButtons() {
    const roadBtns = document.querySelectorAll('.road-btn');
    if (!roadBtns.length) return;

    roadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            roadBtns.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-primary');
            });
            e.target.classList.remove('btn-outline-primary');
            e.target.classList.add('active', 'btn-primary');

            const selectedRoad = e.target.dataset.road;

            if (!selectedRoad || selectedRoad === '全部') {
                displayedRestaurants = [...allRestaurants];
            } else {
                displayedRestaurants = allRestaurants.filter(item => {
                    const roadStr = (item.road || '').toLowerCase();
                    const addrStr = (item.address || '').toLowerCase();

                    if (selectedRoad === '學府路') return addrStr.includes('學府路') || roadStr.includes('學府路');
                    if (selectedRoad === '大學城') return roadStr.includes('大學城') || addrStr.includes('大學城') || addrStr.includes('學府路') || addrStr.includes('182巷');
                    return roadStr.includes(selectedRoad) || addrStr.includes(selectedRoad);
                });
            }
            renderRestaurants(displayedRestaurants);
        });
    });
}

// 搜尋框即時過濾
function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            displayedRestaurants = [...allRestaurants];
            renderRestaurants(displayedRestaurants);
            return;
        }

        displayedRestaurants = allRestaurants.filter(item => {
            const nameMatch = (item.name || '').toLowerCase().includes(query);
            const addressMatch = (item.address || '').toLowerCase().includes(query);
            const categoryMatch = (item.category || '').toLowerCase().includes(query);
            const roadMatch = (item.road || '').toLowerCase().includes(query);
            return nameMatch || addressMatch || categoryMatch || roadMatch;
        });

        renderRestaurants(displayedRestaurants);
    });
}

// 量身訂做進階篩選
function setupSmartFilter() {
    const applyBtn = document.getElementById('apply-filter-btn');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const road = document.getElementById('filter-road')?.value || 'ALL';
        const category = document.getElementById('filter-category')?.value || 'ALL';
        const minRating = parseFloat(document.getElementById('filter-rating')?.value || '0');

        displayedRestaurants = allRestaurants.filter(item => {
            let roadMatch = true;
            if (road !== 'ALL') {
                const addr = item.address || '';
                const r = item.road || '';
                if (road === '學府路') roadMatch = addr.includes('學府路') || r.includes('學府路');
                else if (road === '大學城') roadMatch = r.includes('大學城') || addr.includes('學府路') || addr.includes('182巷');
                else roadMatch = r.includes(road) || addr.includes(road);
            }

            let catMatch = true;
            if (category !== 'ALL') {
                if (category === '宵夜') catMatch = isLateNightFood(item);
                else catMatch = (item.category || '').includes(category) || (item.name || '').includes(category);
            }

            const ratingVal = parseFloat(item.rating || '0');
            const ratingMatch = ratingVal >= minRating;

            return roadMatch && catMatch && ratingMatch;
        });

        renderRestaurants(displayedRestaurants);
    });
}