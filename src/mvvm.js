class MVVM {
  /**
   *Creates an instance of MVVM.
   * @param {*} options.el dom节点
   * @param {*} options.data 数据对象
   * @param {*} options.computed 计算属性
   * @param {*} options.methods 函数方法
   * @memberof MVVM
   */
  constructor(options) {
    // 接收参数
    this.$el = options.el
    this.$data = options.data
    let computed = options.computed
    let methods = options.methods
    let _this = this

    if (this.$el) { // 如果绑定了节点，则进行下一步
      this.proxyData(this.$data) // 代理访问 this.$data，通过 this[prop]访问
      // 把 computed 的 key 值代理到 this 上
      for (let key in computed) {
        Object.defineProperty(this.$data, key, {
          get () {
            return computed[key].call(_this)
          }
        })
      }
      // 把 methods 的方法直接代理到 this 上
      for (let key in methods) {
        Object.defineProperty(this, key, {
          get() {
            return methods[key]
          }
        })
      }

      new Observer(this.$data)
      new Compiler(this.$el, this)
    }
  }

  // 数据代理
  proxyData(data) {
    for (let key in data) {
      // 访问 this.name 实际是访问的 this.$data.name
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newVal) {
          data[key] = newVal
        }
      })
    }
  }
}


/**
 *发布者
 * @class Dep
 */
class Dep {
  constructor() {
    this.subs = [] // 观察者集合
  }
  addSub(watcher) { // 添加观察者实例
    this.subs.push(watcher)
  }
  notify() { // 发布
    this.subs.forEach(w => w.update())
  }
}

/**
 *观察者
 * @class Watcher
 */
class Watcher {
  /**
   *Creates an instance of Watcher.
   * @param {*} vm 实例对象
   * @param {*} expr 属性表达式
   * @param {*} cb 更新触发的回调函数
   * @memberof Watcher
   */
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    this.value = this.get() // 返回旧数据
  }
  get() {
    Dep.target = this
    let value = resolveFn.getValue(this.vm, this.expr) // 取值
    Dep.target = null // 重置为 null
    return value
  }
  update() {
    let newValue = resolveFn.getValue(this.vm, this.expr)
    if (newValue !== this.value) {
      this.cb(newValue) // 执行回调
      this.value = newValue
    }
  }
}

class Observer {
  constructor(data) {
    this.observe(data)
  }
  
  /**
   *数据劫持
   * @param {*} data
   * @memberof Observer
   */
  observe(data) {
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) { // 如果是数组，遍历观察者数组的每一个成员
        data.forEach(v => {
          this.observe(v)
        })
        // 重写数组原型的部分特殊方法
        return
      }

      // 观察对象的每一个属性
      Object.keys(data).forEach(k => {
        this.defineReactive(data, k, data[k])
      })
    }
  }
  defineReactive(obj, key, value) {
    let _this = this // 获取 this 指针
    this.observe(value) // 如果是对象或者数组，再次观察
    let dep = new Dep()
    Object.defineProperty(obj, key, {
      get() {
        // 判断是否需要添加 Watcher，收集依赖
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set(newVal) {
        if (newVal !== value) {
          _this.observe(newVal) // 观察新设置的值
          value = newVal
          dep.notify() // 发布
        }
      }
    })
  }
}

/**
 *模板编译类
 * @class Compiler
 */
class Compiler {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el) // 获取app节点
    this.vm = vm
    let fragment = this.createFragment(this.el) // 将 dom 转换为文档碎片
    this.compile(fragment) // 编译
    this.el.appendChild(fragment) // 交易完成后，重新放回 dom
  }
  // 将 dom 元素转换成文档片段
  createFragment(node) {
    let fragment = document.createDocumentFragment()
    let firstChild
    // 一直去第一个子节点并将其放进文档碎片，知道没有，娶不到则停止循环
    while (firstChild = node.firstChild) {
      fragment.appendChild(firstChild)
    }
    return fragment
  }
  // 检测是否是指令
  isDirective(attrName) {
    return attrName.startsWith('v-')
  }
  // 检测是否是元素节点
  isElementNode(node) {
    return node.nodeType === 1
  }
  // 编译节点
  compile(node) {
    let childNodes = node.childNodes // 获取所有子节点
    let arr = []
    arr.slice.call(childNodes).forEach(child => {
      if (this.isElementNode(child)) { // 是否是元素子节点
        this.compile(child) // 递归遍历子节点
        let attributes = child.attributes
        // 获取元素节点的所有属性 v-model class 等
        let arr = []
        arr.slice.call(attributes).forEach(attr => {
          let { name, value: exp } = attr
          if (this.isDirective(name)) { // 判断是不是指令属性
            let [, directive] = name.split('-')
            let [directiveName, eventName] = directive.split(':')
            resolveFn[directiveName](child, exp, this.vm, eventName)
            // 执行相对应指令方法
          }
        })
      } else { // 编译文本
        let content = child.textContent // 获取文本节点
        if (/\{\{(.+?)\}\}/.test(content)) { // 判断是否有模板语法
          resolveFn.text(child, content, this.vm) // 替换文本
        }
      }
    })
  }
}

// 工具函数
resolveFn = {
  getValue(vm, exp) {
      return exp.split('.').reduce((data, current)=>{
          console.log('current', current);
          return data[current];
      }, vm.$data);
  },
  setValue(vm, exp, value) {
      exp.split('.').reduce((data, current, index, arr)=>{
          if(index === arr.length-1) {
              return data[current] = value;
          }
          return data[current];
      }, vm.$data);
  },
  model(node, exp, vm) {
      new Watcher(vm, exp, (newVal) => {
          node.value = newVal;
      });
      node.addEventListener('input', (e) => {
          let value = e.target.value;
          this.setValue(vm, exp, value);
      });
      let value  = this.getValue(vm, exp);
      node.value = value;
  },
  html(node, exp, vm) {
      new Watcher(vm, exp, newVal => {
          node.innerHTML = newVal;
      });
      let value  = this.getValue(vm, exp);
      node.innerHTML = value;
  },
  on(node, exp, vm, eventName) {
      node.addEventListener(eventName, e => {
          vm[exp].call(vm, e);
      })
  },
  text(node, exp, vm) {
      // 惰性匹配，避免连续多个模板时，会直接取到最后一个花括号
      // {{name}} {{age}} 不用惰性匹配 会一次取全 "{{name}} {{age}}"
      // 我们期望的是 ["{{name}}", "{{age}}"]
      let reg = /\{\{(.+?)\}\}/;
      let expr = exp.match(reg);
      node.textContent = this.getValue(vm, expr[1]);
      new Watcher(vm, expr[1], () => {
          node.textContent = this.getValue(vm, expr[1]);
      });
  }
}