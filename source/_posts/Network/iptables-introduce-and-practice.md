---
title: 深入理解 iptables
date: 2023-12-25 16:20:49
tags:
    - iptables
    - netfilter
categories:
    - Linux
    - Network
---


`iptables`是`Linux`上重要的防火墙程序，它是一个用户态的程序，通过向Linux内核[netfilter](https://www.netfilter.org/)模块注入的钩子函数，以及自定义的规则，实现包过滤，修改，地址转换，日志记录等功能。在`k8s`生态中，作为`kube-proxy`的默认后端，实现流量在集群之内的的路由和转发，写这篇文章的最初原有也是想了解`k8s`是如何将访问到节点上的流量，路由到自定义的`Service`以及最终的`pod`内部。

### netfilter

在了解`iptables`之前，先认识下[netfilter](https://www.netfilter.org/)，它是Linux内核子系统，允许实现各种与网络相关的操作，它是网络相关操作领域的基础设施，基于此可以实现任何大多数网络包的诉求：

- 包过滤，这可能是大多数场景下的诉求，也是`iptables`最多的使用场景，可以用来限制某些特征的包进入到本机，例如，指定ip范围，某类协议的；
- NAT，负责转换网络数据包的源IP和目的IP；
- 数据包修改，地址转换只是数据包修改的一种，还可以修改数据包的TOS（`Type Of Service`，服务类型）、`TTL`指以及为数据包设置`Mark`标记等；

Netfilter框架在Linux内核中提供了一堆钩子，当网络数据包通过内核中的协议栈时，它会遍历这些钩子。Netfilter允许使用这些钩子编写模块并注册回调函数，当钩子被触发时，回调函数将被调用。这些钩子被用在包处理的以下5个阶段：

![netfilter架构图](netfilter-arch.png)

- `NF_INET_PRE_ROUTING`：当数据包从网卡上收到还有路由之前，这类钩子函数就会被触发，然后内核判断这个数据包是否是发往当前主机的，根据条件，将触发以下两个钩子；
- `NF_INET_LOCAL_IN`：当数据包决定路由到本机上的时候，就会触发这类钩子；
- `NF_INET_FORWARD`：当数据包决定要继续转发的时候，这类钩子会被触发；
- `NF_INET_LOCAL_OUT`：这类钩子函数会在本机生成数据包，发出去之前被调用；
- `NF_INET_POST_ROUTING`：这类钩子函数主要用于从本机发出去的数据包，但是在发到网卡之前；

为了清楚地了解Netfilter框架在协议栈内部是如何实现的，我们来看看内核源代码中是如何实现的，我们以`NF_INET_PRE_ROUTING` 阶段的钩子函数为例，下面的代码以 `linux v6.6` 版本为例。我们先看下一个`ipv4`的包到达的时候，它的处理函数[ip_rcv](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_input.c#L560)的实现逻辑：

```c
int ip_rcv(struct sk_buff *skb, struct net_device *dev, struct packet_type *pt,
	   struct net_device *orig_dev)
{
	struct net *net = dev_net(dev);

	skb = ip_rcv_core(skb, net);
	if (skb == NULL)
		return NET_RX_DROP;

	return NF_HOOK(NFPROTO_IPV4, NF_INET_PRE_ROUTING,
		       net, NULL, skb, dev, NULL,
		       ip_rcv_finish);
}
```

从上面的实现代码可以看到，收到包之后，`NF_INET_PRE_ROUTING` 阶段的钩子函数会被调用，我们继续看下[NF_HOOK](https://github.com/torvalds/linux/blob/fbafc3e621c3f4ded43720fdb1d6ce1728ec664e/include/linux/netfilter.h#L308)的实现：

```c
NF_HOOK(uint8_t pf, unsigned int hook, struct net *net, struct sock *sk, struct sk_buff *skb,
	struct net_device *in, struct net_device *out,
	int (*okfn)(struct net *, struct sock *, struct sk_buff *))
{
	int ret = nf_hook(pf, hook, net, sk, skb, in, out, okfn);
	if (ret == 1)
		ret = okfn(net, sk, skb);
	return ret;
}
```

这个函数做两件事，调用 `nf_hook` 运行注入的钩子函数，如果通过该阶段的钩子函数，包没有被丢掉，那么就调用 `okfn`，这里 `okfn` 对应的是 [ip_rcv_finish](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_input.c#L435)。所有5个阶段的钩子函数调用如下所示：

|阶段|文件|函数|
|:--:|:--:|:--:|
|`NF_INET_PRE_ROUTING`|[ip_input.c](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_input.c#L560)|`ip_rcv`|
|`NF_INET_LOCAL_IN`|[ip_input.c](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_input.c#L242)|`ip_local_deliver`|
|`NF_INET_FORWARD`|[ip_forward.c](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_forward.c#L162)|`ip_forward`|
|`NF_INET_LOCAL_OUT`|[ip_output.c](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_output.c#L116C37-L116C37)|`ip_local_out`|
|`NF_INET_POST_ROUTING`|[ip_output.c](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/ip_output.c#L424)|`ip_output`|

因此，`netfilter` 提供了一种可以介入到数据包处理的各种流程中的机制，通过它提供的入口，可以将用户注册的各种用于处理包的流程加入到内核中。那么，我们再来看下注册回调函数的流程，首先是 [nf_register_net_hooks](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/include/linux/netfilter.h#L187) 和 [nf_unregister_net_hooks](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/include/linux/netfilter.h#L189C6-L189C29) 这个注册和去注册的函数：

```c
void nf_unregister_net_hook(struct net *net, const struct nf_hook_ops *ops);
int nf_register_net_hooks(struct net *net, const struct nf_hook_ops *reg, unsigned int n);
```

这里的 [net](https://github.com/torvalds/linux/blob/fbafc3e621c3f4ded43720fdb1d6ce1728ec664e/include/net/net_namespace.h#L61) 参数表明命名空间，如果不指定会取默认值。[nf_hook_ops](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/include/linux/netfilter.h#L87) 描述一个 `hook` 操作：

```c
struct nf_hook_ops {
	/* User fills in from here down. */
	nf_hookfn		*hook;
	struct net_device	*dev;
	void			*priv;
	u8			pf;
	enum nf_hook_ops_type	hook_ops_type:8;
	unsigned int		hooknum;
	/* Hooks are ordered in ascending priority. */
	int			priority;
};
```

其中[nf_hookfn](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/include/linux/netfilter.h#L78C2-L78C2)表示一个钩子函数，[hooknum](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/include/uapi/linux/netfilter.h#L42C13-L42C13) 表示这个钩子函数生效的阶段：

```c
// linux/include/linux/netfilter.h
typedef unsigned int nf_hookfn(void *priv,
			       struct sk_buff *skb,
			       const struct nf_hook_state *state);

// linux/include/uapi/linux/netfilter.h
enum nf_inet_hooks {
	NF_INET_PRE_ROUTING,
	NF_INET_LOCAL_IN,
	NF_INET_FORWARD,
	NF_INET_LOCAL_OUT,
	NF_INET_POST_ROUTING,
	NF_INET_NUMHOOKS,
	NF_INET_INGRESS = NF_INET_NUMHOOKS,
};
```

### iptables

`netfilter` 提供了其他程序介入到内核数据包处理流程的框架，`iptables`提供了一种数据包过滤的方案实现，和 `iptables` 同类的还有 `ip6tables` 以及 `arptables` 用于不同的协议。最新的[nftables](https://netfilter.org/projects/nftables/) 也是一个基于`netfilter`开发的包过滤系统，用于替换替换现有的 `{ip,ip6,arp,eb}tables` 命令，使用用户态的[nft](https://manpages.debian.org/testing/nftables/nft.8.en.html) 命令作为其配置入口，虽然早在Linux kernel 3.13已经加入内核，但是到目前为止仍然不是很普及。

常听到的防火墙工具还有`Deb`发行版的[UFW](https://help.ubuntu.com/community/UFW)，旨在简化`iptables`防火墙配置，提供了一种用户友好的方式来创建基于`IPv4`或`IPv6`主机的防火墙，默认情况下，UFW处于禁用状态。以及Red Hat发行版本默认的[firewalld](https://firewalld.org/)，使用 `nftables` 作为其后端实现。

不过，到目前位置，最广泛使用的还是 `iptables`，`iptables` 命令可以使用 `iptables-translate` 转换为 `nft` 命令：

```
$ iptables-translate -A INPUT -s 192.168.01/16 -p TCP -j DROP
nft add rule ip filter INPUT ip protocol tcp ip saddr 192.168.0.0/16 counter drop
```

`iptables` 的处理流程图如下所示：

![](iptables-architectire.png)

#### table

`iptables`定义了 `filter`、`nat`、`raw`、`mangle`以及`security`5张表，每张表生效的 `netfilter` 阶段不同，`iptables` 将对应于 `netfilter` 不同阶段的规则保存在不同的链中。这`5`张表生效的阶段如下表所示：

|表生效阶段以及对应的链|[filter](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_filter.c#L19)|[nat](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_nat.c#L22)|[mangle](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_mangle.c#L22)|[raw](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_raw.c#L13)|[security](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_security.c#L24)|
|:--:|:--:|:--:|:--:|:--:|:--:|
|`NF_INET_PRE_ROUTING` <-> `PREROUTING`||`-100`|`-150`|`-300`||
|`NF_INET_LOCAL_IN` <-> `INPUT `|`0`|`100`|`-150`||`50`|
|`NF_INET_FORWARD` <-> `FORWARD`|`0`||`-150`||`50`|
|`NF_INET_LOCAL_OUT` <-> `OUTPUT `|`0`|`-100`|`-150`|`-300`|`50`|
|`NF_INET_POST_ROUTING` <-> `POSTROUTING `||`100`|`-150`|||

上面横向看表示表示在netfilter对应的阶段，有哪些表里面的规则会生效，表里面的数字表示优先级，优先级较低的最先执行，纵向看表示表在哪些阶段生效。这些表我们也可以通过查看内核信息文件 `/proc/net/ip_tables_names`：

```
$ cat /proc/net/ip_tables_names
security
raw
nat
mangle
filter
```

这些表他们的作用分别是：

- `filter`：该表包含提供实际防火墙功能的规则，它允许用户决定是否允许数据包到达其目的地；
- `nat `：此表包含允许用户通过更改数据包的源地址和目标地址将数据包路由到NAT网络上的不同主机的规则，它通常用于允许访问无法直接访问的服务；
- `mangle`：该表包含允许用户更改数据包标头和其他形式数据包更改的规则；
- `raw`：该允许用户在内核开始跟踪其状态之前处理数据包，因为它的优先级最高；
- `security`：在`filter`表之后访问该表以实施强制访问控制网络规则，SELinux使用它在数据包上设置SELinux上下文标记；

可以继续从内核代码中寻找这些表创建的逻辑，关于内核代码可以不用继续追究，我们只需要知道内核会在启动过程中把这些表创建好，如果感兴趣的可以继续阅读相关代码，[security](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_security.c#L38)，[filter](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_filter.c#L37C12-L37C37)，[mangle](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_mangle.c#L83)，[nat](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_nat.c#L106) 以及 [raw](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/net/ipv4/netfilter/iptable_raw.c#L37C12-L37C34)。

#### chains

链是规则的集合，当一个数据到达的时候，就会触发注册对应`netfilter`阶段中不同表的钩子，然后遍历对应的链中的规则，直到找到一条匹配的规则。规则是告诉系统如何处理数据包的语句，可以用规则阻止一种类型的数据包，或转发另一种类型的数据包，规则的结果或数据包的发送位置称为`Target`，例如，对于下面这条规则：

> iptables -A INPUT -s 192.168.01 -p TCP -j DROP

没有指定表的时候，默认是 `filter`。这条规则的意思就是匹配源IP为`192.168.01`包然后丢掉，`INPUT`指的是链，`DROP` 就是所谓的 `Target`。

`iptables` 中默认的链如下所示：

- `PREROUTING`：该链中的规则适用于刚到达网络接口的数据包；
- `INPUT`：该链中的规则在数据包被传递给本地进程之前使用；
- `OUTPUT`：这里的规则适用于刚刚由某个本地进程生成的数据包；
- `FORWARD`：此处的规则适用于通过当前主机路由的任何数据包；
- `POSTROUTING`：该链中的规则适用于即将通过网络接口发出去的数据包；

#### targets

`target`指定数据包应该去哪里，常用的有`ACCEPT`、`DROP`或`RETURN`，以及来自它的扩展包中定义的`DNAT`、`LOG`、`MASQUERADE`、`REJECT`、`SNAT`、`TRACE`和`TTL`。

- `ACCEPT`：这意味着 `iptables` 接受该数据包；
- `DROP`：`iptables`会丢弃这个数据包，对于任何尝试连接到系统的人来说，看起来就好像这个系统根本不存在一样；
- `REJECT`：iptables“拒绝”该数据包。对于`TCP`，它发送一个`connection reset`数据包，对于UDP或ICMP，它发送一个`destination host unreachable`数据包；

`iptables`可以用扩展的`target`模块，它们已经被包含在标准的发布包中。如果要看当前系统已经加载了哪些 `target`，可以查看内核文件 `/proc/net/ip_tables_targets`，例如：

![](iptables-targets.png)

我们还可以手动加载内核模块，例如，这里加载 `xt_AUDIT` 扩展：

![](mod_probe_kernel_module.png)

`iptables` 的扩展信息可以通过 `man iptables-extensions` 查看，也可以通过查看[在线文档](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#target%20extensions)。

#### extensions

`iptables`可以使用扩展的数据包匹配模块，使用`-m`或`--match`选项，然后跟上匹配模块的名称，在这之后，根据具体模块的不同，会有各种额外的命令行选项可用。可以在一行中指定多个扩展匹配模块，并且在指定了模块后，可以使用`-h`或`--help`选项来获得该模块的特定帮助信息，扩展匹配模块按照规则中指定的顺序运行。

如果指定了`-p`或`--protocol`，当遇到未知选项时，`iptables` 将尝试加载与协议同名的模块，例如，如果指定了 `--protocol icmp`，当遇到选项 `--icmp-type`，就会自动加载 `icmp` 模块，相当于使用了 `-p icmp -m icmp`。

同样，扩展文档可以使用 `man iptables-extensions` 来查看，或者查看[在线文档](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#match%20extensions)。

查看具体模块的帮助文档，可以在指定模块名称的情况下，使用 `-h` 查看，例如：`iptables -m icmp --help`。

内核已经加载的匹配模块我们可以查看 `/proc/net/ip_tables_matches` 文件，如果发现哪些没有加载，可以手动加载。和`target`不同的是，匹配模块的名称是小写，而`target`是大写。

![](iptable-load-mac-module.png)


### 参考链接

1. [Illustrated introduction to Linux iptables](https://iximiuz.com/en/posts/laymans-iptables-101/)
2. [Iptables Tutorial: Securing VPS with Linux Firewall](https://www.hostinger.com/tutorials/iptables-tutorial)
3. [A Deep Dive into Iptables and Netfilter Architecture](https://www.digitalocean.com/community/tutorials/a-deep-dive-into-iptables-and-netfilter-architecture)
4. [iptables — a comprehensive guide](https://sudamtm.medium.com/iptables-a-comprehensive-guide-276b8604eff1)
5. [What Is iptables and How to Use It?](https://medium.com/skilluped/what-is-iptables-and-how-to-use-it-781818422e52)
6. [Nftables - Packet flow and Netfilter hooks in detail](https://thermalcircle.de/doku.php?id=blog:linux:nftables_packet_flow_netfilter_hooks_detail)
7. [Understanding networking in Kubernetes](https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables)
8. [Kubernetes Services and Iptables](https://msazure.club/kubernetes-services-and-iptables/)
9. [nftables 中文教程](https://icloudnative.io/posts/using-nftables/)
10. [Redhat - nftables 入门](https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/securing_networks/getting-started-with-nftables_securing-networks#doc-wrapper)
11. [kubernetes - 虚拟IP和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
12. [Kubernetes Service iptables 网络通信验证](https://lotabout.me/2022/Kubernetes-Service-Model-Verification/)
13. [Write a Linux firewall from scratch based on Netfilter](https://levelup.gitconnected.com/write-a-linux-firewall-from-scratch-based-on-netfilter-462013202686)
14. [3 ways to make iptables persistent](https://medium.com/@oryaacov/3-ways-to-make-iptables-persistent-a77e956ee78)