/* @meta
{
  "name": "ysbang/auth",
  "description": "药师帮登录认证工具",
  "domain": "dian2.ysbang.cn",
  "args": {
    "action": {"required": false, "description": "操作: status/login/logout"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site ysbang/auth --action status --openclaw"
}
*/

const HOME_URL = 'https://dian2.ysbang.cn';

async function(args) {
  const action = args.action || 'status';

  // 导入安全工具
  let security = null;
  try {
    security = require('../utils/security');
  } catch (e) {
    console.warn('安全工具模块加载失败:', e.message);
  }

  if (action === 'status') {
    // 安全地检查登录状态
    let token = null;

    if (security && security.getSecureCookie) {
      token = security.getSecureCookie('Token');
    } else {
      // 回退到传统方式
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'Token') {
          token = value;
          break;
        }
      }
    }

    if (token) {
      return {
        success: true,
        loggedIn: true,
        token: token.substring(0, 10) + '...',
        hint: '已登录'
      };
    } else {
      return {
        success: true,
        loggedIn: false,
        hint: '未登录，请访问 https://dian2.ysbang.cn 登录'
      };
    }
  } else if (action === 'logout') {
    // 安全地清除 cookie
    const secureAttributes = '; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    const domain = window.location.hostname;

    // 清除可能的所有cookie变体
    document.cookie = `Token=${secureAttributes}`;
    document.cookie = `token=${secureAttributes}`;

    // 如果知道域名，也可以清除特定域名的cookie
    if (domain && domain !== 'localhost') {
      document.cookie = `Token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}`;
      document.cookie = `token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}`;
    }

    return {
      success: true,
      message: '已登出'
    };
  } else {
    return {
      error: '未知的操作',
      hint: '支持: status, logout'
    };
  }
}
