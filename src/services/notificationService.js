// src/services/notificationService.js

// Check and send notifications for orders
export function checkAndSendNotifications(orders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    orders.forEach(order => {
        if (order.delivered || !order.readyDate || !order.customerPhone) {
            return;
        }

        const readyDate = new Date(order.readyDate);
        readyDate.setHours(0, 0, 0, 0);

        // Check if ready tomorrow
        if (readyDate.getTime() === tomorrow.getTime()) {
            sendReadyTomorrowNotification(order);
        }
        
        // Check if ready today
        if (readyDate.getTime() === today.getTime()) {
            sendReadyTodayNotification(order);
        }
    });
}

// Send "Ready Tomorrow" notification
function sendReadyTomorrowNotification(order) {
    let phone = order.customerPhone.replace(/\D/g, '');
    if (phone.length === 10) {
        phone = '91' + phone;
    }

    const message = `Hi ${order.customerName}! 

🔔 Reminder from Polo Fashions

Your order (Card #${order.cardNumber}) will be ready TOMORROW!

📅 Ready Date: ${order.readyDate}
💰 Balance Due: ₹${order.balance}

We look forward to seeing you tomorrow!

🏪 Polo Fashions
📞 9742445626`;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    // Store notification sent flag in localStorage to avoid duplicate sends
    const notificationKey = `notif_tomorrow_${order.id}_${order.readyDate}`;
    if (!localStorage.getItem(notificationKey)) {
        localStorage.setItem(notificationKey, 'sent');
        console.log(`Opening WhatsApp for tomorrow notification: Card #${order.cardNumber}`);
        window.open(whatsappUrl, '_blank');
    }
}

// Send "Ready Today" notification
function sendReadyTodayNotification(order) {
    let phone = order.customerPhone.replace(/\D/g, '');
    if (phone.length === 10) {
        phone = '91' + phone;
    }

    const message = `Hi ${order.customerName}! 

✅ Good News from Polo Fashions!

Your order (Card #${order.cardNumber}) is READY for pickup TODAY! 🎉

📅 Ready Date: ${order.readyDate}
💰 Balance Due: ₹${order.balance}

Please visit us at your convenience to collect your order.

📍 #GF-30, Anjuman-Eslamiya Complex
    T.V.S. Road, Kollegal-571 440

🏪 Polo Fashions
📞 9742445626`;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    // Store notification sent flag in localStorage to avoid duplicate sends
    const notificationKey = `notif_today_${order.id}_${order.readyDate}`;
    if (!localStorage.getItem(notificationKey)) {
        localStorage.setItem(notificationKey, 'sent');
        console.log(`Opening WhatsApp for today notification: Card #${order.cardNumber}`);
        window.open(whatsappUrl, '_blank');
    }
}

// Get orders that need notifications today
export function getOrdersNeedingNotifications(orders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const needingNotifications = {
        tomorrow: [],
        today: []
    };

    orders.forEach(order => {
        if (order.delivered || !order.readyDate || !order.customerPhone) {
            return;
        }

        const readyDate = new Date(order.readyDate);
        readyDate.setHours(0, 0, 0, 0);

        const notificationKeyTomorrow = `notif_tomorrow_${order.id}_${order.readyDate}`;
        const notificationKeyToday = `notif_today_${order.id}_${order.readyDate}`;

        // Check if ready tomorrow and not sent
        if (readyDate.getTime() === tomorrow.getTime() && !localStorage.getItem(notificationKeyTomorrow)) {
            needingNotifications.tomorrow.push(order);
        }
        
        // Check if ready today and not sent
        if (readyDate.getTime() === today.getTime() && !localStorage.getItem(notificationKeyToday)) {
            needingNotifications.today.push(order);
        }
    });

    return needingNotifications;
}

// Send all pending notifications
export function sendAllPendingNotifications(orders) {
    const pending = getOrdersNeedingNotifications(orders);
    
    if (pending.tomorrow.length > 0) {
        console.log(`Found ${pending.tomorrow.length} orders ready tomorrow`);
        pending.tomorrow.forEach(order => {
            setTimeout(() => sendReadyTomorrowNotification(order), 500);
        });
    }
    
    if (pending.today.length > 0) {
        console.log(`Found ${pending.today.length} orders ready today`);
        pending.today.forEach(order => {
            setTimeout(() => sendReadyTodayNotification(order), 1000);
        });
    }

    return pending;
}