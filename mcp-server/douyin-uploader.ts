import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LoginResult {
  success: boolean;
  user?: string;
  cookieCount?: number;
  error?: string;
}

interface CheckLoginResult {
  isValid: boolean;
  user?: string;
}

interface UploadParams {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  headless?: boolean;
  autoPublish?: boolean;
}

interface UploadResult {
  success: boolean;
  title?: string;
  published?: boolean;
  status?: string;
  error?: string;
}

interface CookiesInfo {
  exists: boolean;
  count?: number;
  user?: string;
  created?: string;
}

export class DouyinUploader {
  private cookiesPath: string;
  private userDataDir: string;

  constructor() {
    this.cookiesPath = path.join(__dirname, '../douyin-cookies.json');
    this.userDataDir = path.join(__dirname, '../chrome-user-data');
  }

  async login(headless: boolean = false, timeout: number = 180000): Promise<LoginResult> {
    let browser: Browser | null = null;
    
    try {
      browser = await this.launchBrowser(headless);
      const page = await browser.newPage();
      
      // 访问抖音创作者平台
      await page.goto('https://creator.douyin.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // 等待用户登录
      console.error('Waiting for user login...');
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 5000));
        
        const currentUrl = page.url();
        const isLoggedIn = !currentUrl.includes('/login') && 
                          !currentUrl.includes('passport') &&
                          (currentUrl.includes('creator.douyin.com/creator') || 
                           currentUrl.includes('creator.douyin.com/home'));
        
        if (isLoggedIn) {
          // 获取用户信息
          const user = await this.getUserInfo(page);
          
          // 保存cookies
          const cookies = await page.cookies();
          await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
          
          await browser.close();
          return {
            success: true,
            user,
            cookieCount: cookies.length
          };
        }
      }
      
      await browser.close();
      return {
        success: false,
        error: 'Login timeout'
      };
      
    } catch (error) {
      if (browser) await browser.close();
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async checkLogin(headless: boolean = true): Promise<CheckLoginResult> {
    let browser: Browser | null = null;
    
    try {
      // 检查cookies文件
      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      
      if (!cookies || cookies.length === 0) {
        return { isValid: false };
      }
      
      // 测试cookies
      browser = await this.launchBrowser(headless);
      const page = await browser.newPage();
      await page.setCookie(...cookies);
      
      await page.goto('https://creator.douyin.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await new Promise(r => setTimeout(r, 3000));
      
      const currentUrl = page.url();
      const isValid = !currentUrl.includes('login');
      
      let user = undefined;
      if (isValid) {
        user = await this.getUserInfo(page);
      }
      
      await browser.close();
      return { isValid, user };
      
    } catch (error) {
      if (browser) await browser.close();
      return { isValid: false };
    }
  }

  async uploadVideo(params: UploadParams): Promise<UploadResult> {
    let browser: Browser | null = null;
    
    try {
      // 验证视频文件
      const videoStats = await fs.stat(params.videoPath);
      if (!videoStats.isFile()) {
        throw new Error('Video file not found');
      }
      
      // 加载cookies
      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      
      if (!cookies || cookies.length === 0) {
        throw new Error('No login cookies found. Please login first.');
      }
      
      // 启动浏览器
      browser = await this.launchBrowser(params.headless || false);
      const page = await browser.newPage();
      
      // 设置cookies
      await page.setCookie(...cookies);
      
      // 访问上传页面
      await page.goto('https://creator.douyin.com/creator-micro/content/upload', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await new Promise(r => setTimeout(r, 3000));
      
      // 检查登录状态
      if (page.url().includes('login')) {
        await browser.close();
        throw new Error('Login expired. Please login again.');
      }
      
      // 上传视频
      const fileInput = await page.waitForSelector('input[type="file"]', { 
        timeout: 10000,
        visible: false 
      });
      
      if (!fileInput) {
        throw new Error('Upload input not found');
      }
      
      await fileInput.uploadFile(params.videoPath);
      
      // 等待上传
      const fileSize = videoStats.size;
      const waitTime = Math.max(15000, fileSize / 1024); // 至少15秒
      await new Promise(r => setTimeout(r, waitTime));
      
      // 填写标题
      try {
        await page.waitForSelector('input[placeholder*="标题"]', { timeout: 5000 });
        await page.click('input[placeholder*="标题"]');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type(params.title);
      } catch {
        // 备用方法
        await page.evaluate((title) => {
          const input = document.querySelector('input[type="text"]');
          if (input) {
            (input as HTMLInputElement).value = title;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, params.title);
      }
      
      // 填写描述
      if (params.description) {
        try {
          const descInput = await page.$('div[contenteditable="true"]');
          if (descInput) {
            await descInput.click();
            await page.keyboard.type(params.description);
          }
        } catch {}
      }
      
      // 添加标签
      if (params.tags && params.tags.length > 0) {
        const tagText = params.tags.map(tag => `#${tag}`).join(' ');
        try {
          const descInput = await page.$('div[contenteditable="true"]');
          if (descInput) {
            await descInput.click();
            await page.keyboard.type(' ' + tagText);
          }
        } catch {}
      }
      
      await new Promise(r => setTimeout(r, 2000));
      
      // 发布
      let published = false;
      if (params.autoPublish !== false) {
        published = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const publishBtn = buttons.find(btn => {
            const text = btn.textContent?.trim() || '';
            return text === '发布' || text === '立即发布';
          });
          
          if (publishBtn && !publishBtn.disabled) {
            publishBtn.click();
            return true;
          }
          return false;
        });
        
        if (published) {
          await new Promise(r => setTimeout(r, 3000));
          
          // 检查是否出现短信验证
          const hasSmsVerification = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('短信验证') || text.includes('验证码') || text.includes('手机验证');
          });
          
          if (hasSmsVerification) {
            console.error('\n📱 检测到短信验证页面');
            
            // 尝试点击发送验证码按钮
            const smsSent = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const sendBtn = buttons.find(btn => {
                const text = btn.textContent?.trim() || '';
                return text.includes('发送') || text.includes('获取验证码') || text === '验证';
              });
              
              if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
                return true;
              }
              return false;
            });
            
            if (smsSent) {
              console.error('✅ 已发送验证码到您的手机');

              // 在非头模式下，保持浏览器打开等待用户手动输入验证码
              // 轮询检查验证码输入框是否已被填充
              console.error('请在浏览器窗口中手动输入验证码...');

              const maxWaitTime = 300000; // 最多等待 5 分钟 - 给用户足够时间扫码登录和输入验证码
              const checkInterval = 3000; // 每 3 秒检查一次
              let waitedTime = 0;
              let verifyCode = '';

              console.error('⏳ 等待时间为 5 分钟，请完成扫码登录并输入验证码...');

              while (waitedTime < maxWaitTime) {
                await new Promise(r => setTimeout(r, checkInterval));
                waitedTime += checkInterval;

                // 检查是否有验证码输入框被填充
                const codeFilled = await page.evaluate(() => {
                  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="tel"], input[placeholder*="验证码"]'));
                  if (inputs.length === 0) return null;

                  // 检查单个输入框
                  if (inputs.length === 1 && inputs[0].value) {
                    return inputs[0].value.trim();
                  }

                  // 检查多个输入框（每位一个）
                  let code = '';
                  for (const input of inputs) {
                    if (input.value) {
                      code += input.value.trim();
                    }
                  }
                  if (code.length >= 4) {
                    return code;
                  }

                  return null;
                });

                if (codeFilled) {
                  verifyCode = codeFilled;
                  console.error(`✅ 检测到验证码输入：${verifyCode}`);
                  break;
                }

                // 同时检查是否已经通过了验证（页面变化）
                const stillOnSmsPage = await page.evaluate(() => {
                  const text = document.body.innerText || '';
                  return text.includes('短信验证') || text.includes('验证码') || text.includes('手机验证');
                });

                if (!stillOnSmsPage) {
                  console.error('✅ 验证码已确认，继续发布流程');
                  verifyCode = 'auto-passed';
                  break;
                }
              }

              if (!verifyCode) {
                console.error('⚠️ 等待验证码输入超时，但会继续尝试发布');
              } else if (verifyCode !== 'auto-passed') {
                // 验证码已输入，点击确认按钮
                await page.evaluate(() => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  const confirmBtn = buttons.find(btn => {
                    const text = btn.textContent?.trim() || '';
                    return text.includes('确认') || text.includes('确定') || text.includes('提交') || text === '验证';
                  });

                  if (confirmBtn && !confirmBtn.disabled) {
                    confirmBtn.click();
                  }
                });

                console.error('✅ 确认按钮已点击');
                await new Promise(r => setTimeout(r, 3000));
              }

              // 再次尝试发布
              await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const publishBtn = buttons.find(btn => {
                  const text = btn.textContent?.trim() || '';
                  return text === '发布' || text === '立即发布' || text.includes('确认发布');
                });

                if (publishBtn && !publishBtn.disabled) {
                  publishBtn.click();
                }
              });
            }
          } else {
            // 处理普通确认弹窗
            await page.evaluate(() => {
              const confirmBtns = document.querySelectorAll('button');
              for (const btn of confirmBtns) {
                const text = btn.textContent || '';
                if (text.includes('确认') || text.includes('确定')) {
                  btn.click();
                  return;
                }
              }
            });
          }
          
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      await browser.close();
      
      return {
        success: true,
        title: params.title,
        published,
        status: published ? 'Published' : 'Draft saved'
      };
      
    } catch (error) {
      if (browser) await browser.close();
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getCookiesInfo(): Promise<CookiesInfo> {
    try {
      const cookiesData = await fs.readFile(this.cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      
      const stats = await fs.stat(this.cookiesPath);
      
      return {
        exists: true,
        count: cookies.length,
        created: stats.mtime.toLocaleString()
      };
    } catch {
      return { exists: false };
    }
  }

  async clearData(): Promise<void> {
    try {
      await fs.unlink(this.cookiesPath);
    } catch {}
    
    try {
      await fs.rm(this.userDataDir, { recursive: true, force: true });
    } catch {}
  }

  private async launchBrowser(headless: boolean): Promise<Browser> {
    const browser = await puppeteer.launch({
      headless,
      slowMo: headless ? 0 : 50,
      args: [
        '--window-size=1400,900',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-notifications'
      ],
      defaultViewport: headless ? { width: 1400, height: 900 } : null,
      userDataDir: this.userDataDir,
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    // 设置默认权限
    if (!headless) {
      const context = browser.defaultBrowserContext();
      
      // 覆盖所有权限为允许
      await context.overridePermissions('https://creator.douyin.com', [
        'geolocation',
        'notifications',
        'camera',
        'microphone',
        'clipboard-read',
        'clipboard-write'
      ]).catch(() => {});
      
      await context.overridePermissions('https://www.douyin.com', [
        'geolocation',
        'notifications',
        'camera',
        'microphone'
      ]).catch(() => {});
    }
    
    return browser;
  }

  private async getUserInfo(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        const selectors = ['.user-name', '.nickname', '[class*="username"]', '[class*="user"]'];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        return 'User';
      });
    } catch {
      return 'User';
    }
  }
}