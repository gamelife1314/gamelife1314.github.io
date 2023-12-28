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

用户可以基于自己的需要新创建链，使用 `iptables -N 链名称`。

#### targets

`target`指定数据包应该被如何处理，常用的有`ACCEPT`、`DROP`或`RETURN`，以及来自它的扩展包中定义的`DNAT`、`LOG`、`MASQUERADE`、`REJECT`、`SNAT`、`TRACE`和`TTL`等一大堆。

- `ACCEPT`：这意味着 `iptables` 接受该数据包；
- `DROP`：`iptables`会丢弃这个数据包，对于任何尝试连接到系统的人来说，看起来就好像这个系统根本不存在一样；
- `REJECT`：iptables“拒绝”该数据包。对于`TCP`，它发送一个`connection reset`数据包，对于UDP或ICMP，它发送一个`destination host unreachable`数据包；

每条连应该有默认的`Target`，可以使用如下的方式查看或者更新链的默认 `Target`：

```
# 查看默认策略
$ sudo iptables --list-rules  # or -S
-P INPUT ACCEPT
-P FORWARD ACCEPT
-P OUTPUT ACCEPT

# 将 filter 表中 FORWARD 链的默认策略修改为 DROP
iptables --policy FORWARD DROP  # or -P
```

`Target` 还分为终止型和非终止型，`ACCEPT, REJECT, DROP` 都是终止类型的，意味着在处理完匹配的包之后，后面的规则将不会被执行。而向 `LOG`、`Mark` 它们是非终止的，它们对匹配的包做一些体日志记录或者添加标记之后，继续执行下一条规则。

`iptables`可以用扩展的`target`模块，它们已经被包含在标准的发布包中。如果要看当前系统已经加载了哪些 `target`，可以查看内核文件 `/proc/net/ip_tables_targets`，例如：

![](iptables-targets.png)

我们还可以手动加载内核模块，例如，这里加载 `xt_AUDIT` 扩展：

![](mod_probe_kernel_module.png)

`iptables` 的扩展信息可以通过 `man iptables-extensions` 查看，也可以通过查看[在线文档](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#target%20extensions)。

#### module

`iptables`可以使用扩展的数据包匹配模块，使用`-m`或`--match`选项，然后跟上匹配模块的名称，在这之后，根据具体模块的不同，会有各种额外的命令行选项可用。可以在一行中指定多个扩展匹配模块，并且在指定了模块后，可以使用`-h`或`--help`选项来获得该模块的特定帮助信息，扩展匹配模块按照规则中指定的顺序运行。

如果指定了`-p`或`--protocol`，当遇到未知选项时，`iptables` 将尝试加载与协议同名的模块，例如，如果指定了 `--protocol icmp`，当遇到选项 `--icmp-type`，就会自动加载 `icmp` 模块，相当于使用了 `-p icmp -m icmp`。

同样，扩展文档可以使用 `man iptables-extensions` 来查看，或者查看[在线文档](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#match%20extensions)。

查看具体模块的帮助文档，可以在指定模块名称的情况下，使用 `-h` 查看，例如：`iptables -m icmp --help`。

内核已经加载的匹配模块我们可以查看 `/proc/net/ip_tables_matches` 文件，如果发现哪些没有加载，可以手动加载，也可以在使用时自动加载。和`target`不同的是，匹配模块的名称是小写，而`target`是大写。

![](iptable-load-mac-module.png)

#### rules

一条规则表达了匹配具有什么特征的包做什么动作，使用 `iptables` 命令创建规则的格式如下所示：

> `sudo iptables [option] CHAIN_rule [-j target]`

下面是一个示例，表示接受来自`192.168.0.27`包：

> sudo iptables –A INPUT –s 192.168.0.27 –j ACCEPT
> sudo iptables --append INPUT –-source 192.168.0.27 –-jump DROP

根据日常的使用场景，举一些比较常用的例子。

##### 禁止来自某个IP的报文

`REJECT` 来自某个`IP`地址的报文：

```
iptables \
--table filter \             # Use the filter table
--append INPUT \             # Append to the INPUT chain
--source 59.45.175.62 \      # This source address
--jump REJECT                # Use the target Reject
```

精确删除这条规则：

```
iptables \
--table filter \             # Use the filter table
--delete INPUT \             # Delete from the INPUT chain
--source 59.45.175.62 \      # This source address
--jump REJECT                # Use the target Reject
```

可以更新这条规则，更换里面的 `IP`：

```
iptables \
--table filter \             # Use the filter table
--replace INPUT \            # Replace from the INPUT chain
--source 59.45.175.62 \      # This source address
--jump REJECT                # Use the target Reject
```

`-t filter` 我们可以不用声明，默认就是这张表。

##### 添加规则到具体位置

首先需要需要打印出当前表中的规则序号，然后才能精准插入到某个位置：

> iptables --list --line-numbers

这个命令会把规则的顺序打印出来：

```
Chain INPUT (policy ACCEPT)
num target prot opt source destination
1 DROP all -- 59.45.175.0/24 anywhere
2 DROP all -- 221.194.47.0/24 anywhere
3 DROP all -- 91.197.232.104/29 anywhere

Chain FORWARD (policy ACCEPT)
num target prot opt source destination

Chain OUTPUT (policy ACCEPT)
num target prot opt source destination
1 DROP all -- anywhere 31.13.78.0/24
```

假设我们要组织除了其中一个地址`59.45.175.10`之外的整个`IP`块`59.45.175.0/24`，由于`iptables`按序遍历规则并且处理，所以我们在最开始的位置将`59.45.175.10`加入白名单即可：

```
iptables --table filter --insert INPUT 1 --source 59.45.175.10 --jump ACCEPT
```

现在 `INPUT` 链中的规则应该如下所示：

```
Chain INPUT (policy ACCEPT)
num target prot opt source destination
1 ACCEPT all -- 59.45.175.10 0.0.0.0/0
2 DROP all -- 59.45.175.0/24 0.0.0.0/0
3 DROP all -- 221.192.0.0/20 0.0.0.0/0
4 DROP all -- 91.197.232.104/29 0.0.0.0/0
```

##### 修改链的默认策略

如果链中没有任何规则匹配时对数据包执行的操作，默认链默认有一个接受策略，可以使用下面的方式更改默认策略：

> iptables --policy INPUT DROP

##### 禁止访问某个端口

例如，我们可以禁止某个访问的`IP`登录我们的主机：

```
iptables \
--append INPUT \
--protocol tcp \             # Specify TCP protocol
--match tcp \                # Load the TCP module
--dport 22 \                 # Destination port 
--source 59.45.175.0/24 \
--jump DROP
```

可以使用`multiport`模块提供的匹配功能，禁止访问多个端口：

```
iptables \
--append INPUT \
--protocol tcp \
--match multiport \         # Load multiport module
--dports 22,5901 \
--source 59.45.175.0/24 \
--jump DROP
```

可以使用如下的语法提供反向匹配，`!`表示除什么之外，这里表示除了`22,80,443`这几个端口，都禁止访问：

```
iptables --append INPUT --protocol tcp --match multiport ! --dports 22,80,443 --jump DROP
```

禁止`icmp`请求：

```
iptables --append INPUT --jump REJECT --protocol icmp --icmp-type echo-request
```

`REJECT`表现出来的就像这个主机存在但是回复了错误，但`DROP`表现的就像这个目的主机不存在一样，没有任何错误信息：

```
iptables --append INPUT --protocol icmp --jump DROP --icmp-type echo-request

iptables --append OUTPUT --protocol icmp --jump DROP --icmp-type echo-reply
```

##### TCP连接状态跟踪

如果我们通过`INPUT`链禁止了某个`IP`访问本机，那我们同样也访问了这个`IP`，因为即使我们的请求到达了对端，但是对端的响应在到达本机的途中，经过`iptables`时被丢掉了。但是我们可以通过`conntrack`模块解决这个问题，因为`iptables`是一个有状态的防火墙，我们可以使用这个模块跟踪一下任意状态：

- `NEW`：该状态表示连接的第一个数据包；
- `ESTABLISHED`：此状态表示属于现有连接一部分的数据包，对于处于这种状态的连接，它应该已经收到来自其他主机的答复；
- `RELATED`：此状态表示与另一个`ESTABLISHED`连接相关的连接。`FTP`数据连接就是一个例子——它们与已经建立的控制连接相关；
- `INVALID`：这表示数据包没有正确的状态。这可能是由于多种原因造成的，例如系统内存不足或由于某些类型的`ICMP`流量所致；
- `UNTRACKED`：`raw`表中具有`NOTRACK`目标的任何免于连接跟踪的数据包最终都会处于此状态；
- `DNAT`：这是一个虚拟状态，表示包的目的地址已经被`nat`表中的规则更改；
- `SNAT`：和 `DNAT` 一样，表示包的源地址已经被更改；

因为，为了达到本节开始的目的，允许`RELATED`和`ESTABLISHED`状态的包到达本机：

```
iptables \
--append INPUT
--match conntrack 
--ctstate RELATED,ESTABLISHED \
--jump ACCEPT       # Accept packets in above connection states
```

##### 常用防安全攻击规则

如果要阻止圣诞树攻击（TCP所有标志位被设置为1的数据包被称为圣诞树数据包（XMas Tree packet），之所以叫这个名是因为这些标志位就像圣诞树上灯一样全部被点亮），可以用下面这样的命令：

```
iptables --append INPUT --protocol tcp --match tcp --tcp-flags ALL FIN,PSH,URG --jump DROP
```

为了阻止常见的无效数据包，例如同时设置了`SYN`和`FIN`的数据包，我们可以简单地查找同时设置了这两个数据包的数据包。执行此操作：

```
iptables --append INPUT --protocol tcp --match tcp --tcp-flags SYN,FIN SYN,FIN --jump DROP
```

还有阻止不以 `SYN`开头的新连接数据包：

```
iptables --append INPUT --protocol tcp --match conntrack --ctstate NEW --match tcp ! --tcp-flags FIN,SYN,RST,ACK SYN --jump DROP
```

##### 速率限制

`limit` 通过令牌桶实现速率限制，它有两个主要参数，`--limit-burst` 充当缓冲区，是缓冲区大小，如果超过此缓冲区大小，则所有数据包都会被丢弃，但可以以`--limit`往这个桶里面放入令牌：

```
 --limit rate[/second|/minute|/hour|/day]
    Maximum  average  matching rate: specified as a number, with an optional `/second',
    `/minute', `/hour', or `/day' suffix; the default is 3/hour.

--limit-burst number
    Maximum initial number of packets to match: this number gets recharged by one every
    time the limit specified above is not reached, up to this number; the default is 5.
```

例如限制每秒只能处理一个`ICMP`请求：

> iptables --append INPUT --protocol icmp --match limit --limit 1/sec --limit-burst 1 --jump ACCEPT

我们可以使用`recent`模块实现一个动态限制，例如，我们可以限制某个IP在过去的`180s`内最多`5`次连接到本机，不过这通常需要两个命令配合完成：

```
# 将访问22端口的IP都放在一个名为SSHLIMIT的列表中
iptables --append INPUT --protocol tcp \
--match tcp --dport 22 \
--match conntrack --ctstate NEW \
--match recent --set --name SSHLIMIT --rsource

# 匹配180s内访问22端口5次的报文丢掉
iptables --append INPUT --protocol tcp \
--match tcp --dport 22 \
--match conntrack --ctstate NEW \
--match recent --set --name SSHLIMIT --update --seconds 180 --hitcount 5 --name SSH --rsource --jump DROP
```

##### 本地端口重定向

例如，我们可以将访问本地`80`端口的包转发到`8080端口`：

```
iptables --table nat --append PREROUTING --protocol tcp — dport 80 --jump REDIRECT --to 8080
```


#### 规则持久化

通过用户空间的 `iptables` 命令创建的规则或者链默认只存在于内存中，当系统重新启动就会丢失，如果要对已经创建的规则进行保存，首先可以手动调用 `iptables-save` 命令：

> sudo iptables-save > /etc/iptables/rules.v4
> sudo ip6tables-save > /etc/iptables/rules.v6

在想要恢复的时候，调用 `iptables-restore` 命令进行恢复：

> sudo iptables-restore < /etc/iptables/rules.v4
> sudo ip6tables-restore < /etc/iptables/rules.v6

如果想要自动进行 `iptables` 规则保存，需要安装 `iptables-persistent` 服务：

> sudo apt-get install iptables-persistent

```
$> apt-get install iptables-persistent
....
Created symlink /etc/systemd/system/multi-user.target.wants/netfilter-persistent.service → /lib/systemd/system/netfilter-persistent.service.
Setting up iptables-persistent (1.0.16) ...
update-alternatives: using /lib/systemd/system/netfilter-persistent.service to provide /lib/systemd/system/iptables.service (iptables.service) in auto mode
```

这将安装 `netfilter-persistent.service` 和 `iptables.service` 两个系统服务，他们之间是冲突的，只能启动一个：

```
$> systemctl start netfilter-persistent.service
$> systemctl status netfilter-persistent.service
● netfilter-persistent.service - netfilter persistent configuration
     Loaded: loaded (/lib/systemd/system/netfilter-persistent.service; enabled; vendor preset: enabled)
    Drop-In: /etc/systemd/system/netfilter-persistent.service.d
             └─iptables.conf
     Active: active (exited) since Tue 2023-12-26 20:47:40 CST; 17s ago
       Docs: man:netfilter-persistent(8)
   Main PID: 1281646 (code=exited, status=0/SUCCESS)

Dec 26 20:47:40 michael systemd[1]: Starting netfilter persistent configuration...
Dec 26 20:47:40 michael netfilter-persistent[1281648]: run-parts: executing /usr/share/netfilter-persistent/plugins.d/15-ip4tables start
Dec 26 20:47:40 michael netfilter-persistent[1281648]: run-parts: executing /usr/share/netfilter-persistent/plugins.d/25-ip6tables start
Dec 26 20:47:40 michael systemd[1]: Finished netfilter persistent configuration.
$>
$> cat /etc/systemd/system/netfilter-persistent.service.d/iptables.conf
[Unit]
Conflicts=iptables.service ip6tables.service
```

`netfilter-persistent.service` 会自动将最新的规则刷新到 `/etc/iptables/rules.v4` 文件，并且在系统启动时自动恢复。

#### 日志记录

如果希望将某些匹配的包记录到日志文件中，可以使用`LOG`这个`Target`，正好使用`LOG`验证下之前说明的`iptables`在不同阶段不同表的顺序。在使用之前，我们先需要开启`rsyslog`服务，并且将`iptables`的日志单独输出到一个文件中：

```
# 编辑文件，/etc/rsyslog.conf，增加下面一行
kern.* /var/log/iptables.log
```

然后重启`rsyslog`服务：

> systemctl restart rsyslog

然后写入下面的规则，下面这些规则正好是本机产生的数据包发送出去的流程，其中的`172.23.32.1`是本次测试的目的地：

```shell
# OUTPUT
iptables -t raw -A OUTPUT -d 172.23.32.1 -j LOG --log-prefix "DEBUG_RAW_OUTPUT "
iptables -t mangle -A OUTPUT -d 172.23.32.1 -j LOG --log-prefix "DEBUG_MANGLE_OUTPUT "
iptables -t nat  -A OUTPUT -d 172.23.32.1 -j LOG --log-prefix "DEBUG_NAT_OUTPUT "
iptables -t filter  -A OUTPUT -d 172.23.32.1 -j LOG --log-prefix "DEBUG_FILTER_OUTPUT "
iptables -t security  -A OUTPUT -d 172.23.32.1 -j LOG --log-prefix "DEBUG_SECURITY_OUTPUT "

# POSTROUTING
iptables -t mangle -A POSTROUTING -d 172.23.32.1 -j LOG --log-prefix "DEBUG_MANGLE_POSTROUTE "
iptables -t nat -A POSTROUTING -d 172.23.32.1 -j LOG --log-prefix "DEBUG_NAT_POSTROUTE "
```

然后发送一个`icmp`报文到达目的地：

> ping -c 1  172.23.32.1

此时可以从日志文件`/var/log/iptables.lo`中获取到如下的信息，正好是`iptables`处理发包经过的表和链：

```
$> grep 172.23.32.1 /var/log/iptables.log |grep 64425
Dec 28 14:43:23 docker1 kernel: [259986.509060] DEBUG_RAW_OUTPUT IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509066] DEBUG_MANGLE_OUTPUT IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509071] DEBUG_NAT_OUTPUT IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509076] DEBUG_FILTER_OUTPUT IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509078] DEBUG_SECURITY_OUTPUT IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509080] DEBUG_MANGLE_POSTROUTE IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
Dec 28 14:43:23 docker1 kernel: [259986.509082] DEBUG_NAT_POSTROUTE IN= OUT=eth0 SRC=172.23.44.230 DST=172.23.32.1 LEN=62 TOS=0x00 PREC=0x00 TTL=64 ID=64425 DF PROTO=UDP SPT=52967 DPT=53 LEN=42
```

同理，我们也可以使用如下的规则验证收报的的流程：

```shell
# PREROUTING
iptables -t raw -s 172.23.32.1 -A PREROUTING -j LOG --log-level "warning" --log-prefix "RAW_PREROUTE "
iptables -t mangle -s 172.23.32.1 -A PREROUTING -j LOG --log-level "warning" --log-prefix "MANGLE_PREROUTE "
iptables -t nat -s 172.23.32.1 -A PREROUTING -j LOG --log-level "warning" --log-prefix "NAT_PREROUTE "

# INPUT
iptables -t mangle -s 172.23.32.1 -A INPUT -j LOG --log-level "warning" --log-prefix "MANGLE_INPUT "
iptables -t filter -s 172.23.32.1 -A INPUT -j LOG --log-level "warning" --log-prefix "FILTER_INPUT "
iptables -t security -s 172.23.32.1 -A INPUT -j LOG --log-level "warning" --log-prefix "SECURITY_INPUT "
iptables -t nat -s 172.23.32.1 -A INPUT -j LOG --log-level "warning" --log-prefix "NAT_INPUT "
```

`ping`之后会得到如下的日志信息，和我们的收报流程正好相符：

```
$> grep 172.23.32.1 /var/log/iptables.log |grep 21931
Dec 28 15:11:29 docker1 kernel: [261673.089976] RAW_PREROUTE IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090111] MANGLE_PREROUTE IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090198] NAT_PREROUTE IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090215] MANGLE_INPUT IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090226] FILTER_INPUT IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090234] SECURITY_INPUT IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
Dec 28 15:11:29 docker1 kernel: [261673.090262] NAT_INPUT IN=eth0 OUT= MAC=ff:ff:ff:ff:ff:ff:00:15:5d:7c:72:a1:08:00 SRC=172.23.32.1 DST=172.23.47.255 LEN=229 TOS=0x00 PREC=0x00 TTL=128 ID=21931 PROTO=UDP SPT=138 DPT=138 LEN=209
```


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