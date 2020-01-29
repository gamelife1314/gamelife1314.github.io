---
title: Let's Encrypt DV 证书申请
date: 2020-01-29 19:28:32
tags:
  - Let's Encrypt
---


随着互联网的快速发展，安全问题日益凸现出来成为焦点，传统 Web 领域 HTTP 协议的透明文本传输容易造成信息泄漏，引发各种不安全问题，HTTPS 的到来，将会极大改善这一现状，全站 HTTPS 也是势在必行。部署 HTTPS 网站必不可少的部分就是 CA 证书，但是大多数证书颁发机构是收费的，自签名证书浏览器又不认，好在有 [Let's Encrypt](https://letsencrypt.org) 这样的机构，为安全的互联网世界贡献了极大的力量。

{% asset_img bg.jpg bg %}

<!--more-->


### Let's Encrypt CA 机构

Let's Encrypt 完全是一个**免费**的机构，非盈利组织，旨在推动 HTTPS 网站部署。传统的CA机构都是人工签发证书的，因为要负责校验证书请求，接着校验服务器身份，再签发证书，当服务器更新或者撤销证书的时候，还得人工像CA机构申请，相当磨叽。Let's Encrypt 作为免费 CA 机构，为了让整个过程高效，免费，所以设计一个证书管理协议：ACME （[Automatic Certificate Management Environment](https://github.com/ietf-wg-acme/acme)） ，通过该协议可以实现各种客户端代理，由客户端代理向 Let's Encrypt 申请和撤销证书，整个过程不用人工干预， 完全**自动化**。传统的CA机构在生成证书的时候，会同时生成证书和密钥对，并且通过邮件传输，但实际上，CA机构不应该掌握服务器的私钥，这样极不安全。ACME协议在设计额时候，充分考虑了传统CA签发证书的各种弊端，客户端代理和 Lets Encrypt 之间的通信都是密码学保护的，客户端代理负责生成 CSR （Certificate Sign Request）文件和密钥对，Let's Encrypt 并不知道服务器私钥，所以非常 **安全**。

不过，由于 Let's Encrypt 作为新成立的 CA 机构，大部分浏览器没有将它的根证书并放置到自己的可信任根证书列表中，为了快速投入运营， Let's Encrypt 使用 IdenTrust 的根证书（DST Root CA X3）对其进行交叉签名，如下图：

![Let's Encrypt 证书信任连](1.png)

Let's Encrypt 作为一个较新的CA机构，采用了 SHA2 摘要算法族作为数字签名的基元，如果证书校验方相对较老（比如XP）那就不支持 Let's Encrypt 证书了。

Let's Encrypt 只能提供 DV（Domain Validated） 类型证书，不能提供 OV (Organization Validated) 和 EV（Extended Validated）类型证书，后两者需要人工校验服务器实体身份，Let's Encrypt 作为一个自动化的操作过程，无法进行人工审核，申请证书的时候， Let's Encrypt 通过以下两种方式校验身份：

1. 服务器实体根据要求添加一条 DNS TXT 记录
2. 在服务器上放置一个 URL 资源 (well-known URL 资源)

Let's Encrypt 证书默认只有 **90 天有效期**，但是可以自动续期，这个规定的主要原因在于：

1. 避免证书滥用；
2. 提供安全性，一旦服务器实体泄露了私钥，该服务器实体证书就是高危证书，如果服务器实体没有意识到私钥泄漏，期限越长证书危害就越大；

Let's Encrypt 证书申请限制：

1. 一张证书最多只能包含 100 个主机名；
2. 每个注册于每周只能申请20张证书；
3. 撤销证书没限制；
4. renew 证书没限制，这里指为整数续期；
5. 主机名完全一样的证书每周只能签发5次
    
    1. 如果原证书还有m个主机，在此基础上扩展n个主机，不会有限制；
    2. 如果原证书包含m个主机，现在需要更新该证书的属性，比如更换证书包含的公钥，但主机名并没有变更，则会有5次限制。


### Let's Encrypt 工作原理

对此官方有详细的解释，[https://letsencrypt.org/how-it-works/](https://letsencrypt.org/how-it-works/)，我在这里再重复一下。

#### 域名校验过程

1. 客户端代理第一次和 Let's Encrypt 交互的时候，首先会创建一个账户，该账户可以叫做代理账户，对于 Let's Encrypt 来说，账户和运行客户端代理的机器是意义对应的。

2. 客户端代理创建用户后，会生成公开密钥算法的一对密钥，这对密钥叫做校验密钥对，客户端代理会将公钥发给 Let's Encrypt，校验密钥对是用来保证 ACME 的安全。

3. 客户端申请证书，并选择域名校验方式，DNS TXT 记录 或者 HTTP well-known URL 资源方式。

4. Let's Encrypt 在收到客户端代理的请求之后，先是使用校验密钥对的公钥验证签名，紧接着根据客户端代理提供的域名验证方式验证域名，一旦通过，则通知代理客户端域名校验成功。

#### 请求，更新，续期，撤销证书

域名所有权校验成功之后，客户端代理一般通过 4 个操作去管理证书，分别是请求（request），更新（renewval），续期（renew）,撤销（revok）。

##### 申请证书

客户端代理根据 PKCS#10（Certification Request Standard） 标准生成 CSR 文件和服务器密钥对，CSR 文件本身用服务器密钥对私钥签名，然后客户端代理使用校验密钥对私钥对整个ACME协议消息签名。

Let's Encrypt 在收到客户端代理的请求之后，用校验密钥对公钥验证整个ACME协议消息签名，然后根据标准处理 CSR 文件，最终将证书发给客户端代理。

##### 撤销证书

流程和申请差不多，客户端代理签名证书撤销消息并且发送给 Let's Encrypt，Let's Encrypt 校验签名后更新自己的 CRL 和 OCSP 信息，这样证书校验方（浏览器）在验证的时候就知道最新的证书吊销状态了。


### Certbot 代理客户端

实现 ACEME 的全部列表在这里，[https://letsencrypt.org/docs/client-options/](https://letsencrypt.org/docs/client-options/)，选择自己喜欢的一个就行，下面我们介绍一下 Certbot 客户端，并用其真正申请一张证书。Certbot 官网在此：[https://certbot.eff.org/](https://certbot.eff.org/)。


#### 准备工作

我先解析一个新的域名，tls-ssl.fudenglong.site，添加一个新的网站，一开始是 http 协议，到最后我把它整成一个 https 站点。

![2.png](2.png)
![2.png](3.png)


#### 安装 Certbot 客户端

依据文档，[https://certbot.eff.org/docs/install.html#certbot-auto](https://certbot.eff.org/docs/install.html#certbot-auto)，照着来一下，certbot-auto 是 certbot 的一个外壳程序，我们可以理解为他们俩是一样的，初次运行的时候，会安装一些依赖包，而且能自动升级安装版本。

    user@webserver:~$ wget https://dl.eff.org/certbot-auto
    user@webserver:~$ chmod a+x ./certbot-auto
    user@webserver:~$ ./certbot-auto --help

![安装 Certbot](4.png)

certbot 的帮助信息很全面，操作一两次完全可以根据帮助进行：

        ./certbot-auto --help all

#### 用户注册

cerbot 客户端能够自动创建账户，该操作对于操作者来说是不可见的，操作者也可以手动创建用户，运行下列命令表示创建一个用户：

    ./certbot-auto register --agree-tos

![5.png](5.png)

Certbot 在创建一个用户账户，会初始化一些目录，都在 `/etc/letsencrypt` 目录下：

![6.png](6.png)

`/etc/letsencrypt/accounts` 是包含账号的目录，其他目录后续会介绍的，我这里写这篇文章之前已经生成过证书，所以存在一些文件夹。

#### 获取和安装证书

通过 CErtbot 客户端，服务器实体可以用多种途径获取和安装证书， Certbot 客户端以插件的方式获取证书，比如说可以通过 nginx，apache 等插件获取和安装证书。Certbot 有两种类型的插件，分别是验证模式和安装模式插件。

##### 验证模式（Authenticators）插件

该插件主要使用 certonly 子命令操作，生成的证书保存在 /etc/letsencrypt 目录下，这种类型的插件只会获取证书，不会安装证书，更不会配置相应的 https 指令。

##### 安装模式（Installers）插件

该插件主要使用 install 子命令（实际运行 certbot-auto run 子命令），Certbot 获取到证书以后会自动修改 web 服务器配置，修改响应的 https 指令，然后重启服务器。

安装插件模式非常方便，操作者无需任何多与操作就能够自动获取证书并部署一个https网站，不同类型的插件，域名校验方式各有差异， Certbot 客户端主要支持三种模式：

1. dns-01: 给域名添加一个 DNS TXT 记录；
2. http-01: 在域名对应的 Web 服务器下放置一个 http well-known URL 资源文件；
3. tls-sni-01: 在域名对应的 Web 服务器下放置一个 https well-known URL 资源文件！！！That's funny，想要部署 https 网站，却要用 https 的方式校验域名控制权，不过这种方式是 Certbot 客户单自动操作的。

#### Certbot nginx 插件

该插件会分析web服务器上的nginx虚拟主机配置文件，找出对应的主机名，以交互式的方式询问操作者要为哪些主机生成证书，获取证书后会配置相应的 nginx https 指令，还会以询问的方式询问是否配置 HSTS 和 Rewrite 指令，最后自动重启 nginx 服务器。

该插件的三个重要指令：

1. `-n` 不使用交互式的方式操作；
2. `--test-cert` 为避免遇到证书生成限制，可以在 Let's Encrypt 的 staging 的服务器上申请证书，staging 服务器上生成证书限制较少；
3. `--day-run` 只是测试命令是否能够正确工作，可以使用该参数，该参数只适合 certonly 和 renew 子命令；

为我的 tls-ssl.fudenglong.site 生成证书，执行了下面的命令（你们在执行时，根据情况填参数）：

        ./certbot-auto run --nginx --nginx-server-root /www/server/nginx/conf/ --nginx-ctl /www/server/nginx/sbin/nginx

![7.png](7.png)

再来看我的站点：

![8.png](8.png)

nginx 配置文件也被修改了：

![9.png](9.png)

现在 `/etc/letsencrypt` 目录结构如下，由于我们申请了新证书，所以多了关于 `tls-ssl.fudenglong.site` 的目录：

![10.png](10.png)

`/etc/letsencrypt/archive/` 目录主要存放某个域名的所有证书，因为一个证书可能有多个版本：

![11.png](11.png)

    - privkey1.pem   服务器私钥
    - cert1.pem      服务器证书
    - chain1.pem     CA 中间证书
    - fullchain1.pem 证书链

`/etc/letsencrypt/live/` 目录存放某个域名当前的证书，只是用软连接指向最新的证书文件：

![12.png](12.png)

`/etc/letsencrypt/renewal` 记录 Cerbot 用来管理证书的配置文件，通过该文件知道某个证书有多少个版本、live 指向哪个文件：

![13.png](13.png)


#### Certbot Webroot 插件

该插件属于验证模式，值获取证书，不安装证书，**只支持** http-01 域名验证模式，举个例子：

    ./certbot-auto certonly --webroot -w /www/wwwroot/tls-ssl.fudenglong.site/ -d tls-ssl.fudenglong.site --rsa-key-size 2048 --dry-run

![15.png](15.png)

#### Certbot Standalone 插件

如果运行 Certbot 客户端的机器没有 Web 服务，那么如何使用 tls-sni 和 http-01 域名验证模式？该插件内置一个 Web 服务器，提供两种方式校验：

    # tls-sni 模式
    ./certbot-auto certonly --stadalone -d www1.example.com

    # 使用 http-01 模式
    ./certbot-auto certonly --stadalone -d www1.example.com --preferred-challenges http

#### Certbot Manual 插件

手动申请证书，并且通过 dns 验证模式：

    ./certbot-auto certonly  -d *.fudenglong.site --manual --preferred-challenges dns 

#### 更新证书

    ./certbot-auto certonly --standalone -d www4.example.com --force-renewa --rsa-key-size 2048

#### 扩展证书

    ./certbot-auto certonly --standalone --expand -d www4.example.com -d www5.example.com 

#### 续期证书

    ./certbot-auto renew --post-hook "/www/server/nginx/sbin/nginx -s reload"

可以放置在计划任务 crontab 中执行，实现自动续期。

#### 查看所有 Certbot 申请的证书

    ./certbot-auto certificates

![14.png](14.png)


### 课外阅读

1. [使用免费 Let’s Encrypt 实现 ECDSA/RSA 双证书](https://guozeyu.com/2016/08/install-nginx-1-11-on-ubuntu/)