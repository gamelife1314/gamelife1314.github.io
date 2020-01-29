---
title: 理清 MySQL 不要再犯迷糊
date: 2020-01-30 00:16:41
tags:
  - MySQL
---


知其然知其所以然，让我们搞明白 MySQL 背后的一些基础知识，不要再犯迷糊咯，[MySQL 官网](https://dev.mysql.com/doc/refman/5.7/en/)，在写 SQL，创建数据表的时候，知道自己的每一个数据类型选择，索引选择到底会如何影响性能。**文本的配图，一些例子来源于极客时间教程 [《MySQL实战45讲》](https://time.geekbang.org/column/article/70562)，如有侵权，请联系我删除。**

<!-- more -->


### 理解 SQL 语句背后是如何执行的

对于一个简单的 [Select](https://dev.mysql.com/doc/refman/5.7/en/select.html) 语句，可曾想过背后的执行逻辑和过程，我是没想过，看了极客时间的课程终于知道，我们先来一张 MySQL 的架构示意图：

![MySQL 架构图](./MySQL-架构图.png)

MySQL 是一个分层架构，包含 **Server 层** 和 **存储引擎层** 两部分，**Server 层**包括了连接器，查询缓存，分析器，优化器，执行器等，涵盖 MySQL 大多数核心服务功能，以及所有的内置函数，所有的跨存储引擎的功能都在这一层实现，不如存储过程，触发器，视图等。而存储引擎层负责数据的存储和提取，其架构模式是插件式的，支持 InnoDB、MyISAM 、Memory 等。InnoDB 从 MySQL5.5.5 版本开始成为了默认存储引擎。


#### 连接器

在进行所有的操作之前，我们会先进行连接数据库，例如执行命令：`mysql -h 127.0.0.1 -u root -P 3306 -p`，紧接着输入密码，这个时候连接器会执行密码验证和权限读取：

1. 如果密码输入错误，就会提示 **ERROR 1045 (28000): Access denied for user 'root'@'127.0.0.1' (using password: YES)** 类似这样的错误；
2. 通过验证之后，连接器会到权限表里面查询当前用户所拥有的权限，这个连接里面的权限判断逻辑都依赖于此时读到的权限。

连接成功之后，如果没有后续动作，这个连接就处于空闲状态（`show processlist` Command 列为 *Sleep*），如果客户端太长时间没有活动，连接器就会自动将其断开，这个时间是由 **[wait_timeout](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_wait_timeout)** 参数控制，默认为 8 小时。

![查看空闲连接](1.png)

需要注意的是，MySQL 建立连接的过程还是较为繁琐的，首先必要的 TCP 三次握手，还有权限验证查询等，因此我们应该尽量使用长连接，也即是客户端的查询请求尽可能在一个连接上面，不要执行一次操作就断开重新连接一次。但是在使用长连接之后，MySQL 的内存又是涨得很快，这是因为 MySQL 在执行过程中临时使用的内存是管理在连接对象里面的， 而且这些连接占用的内存只有在连接断开的时候才会被释放。所以长连接累计可能会导致 MySQL 被系统强行 OOM，解决方案可以参考：

1. 定期断开长连接，使用一段时间或者程序里面判断执行过一个占用内存的大查询后，断开连接然后重连。
2. 如果使用的是 MySQL5.7 以上的版本，可以在每次执行一个较大的操作后，通过执行 mysql_rest_connection 来重新初始化连接资源。这个过程不会做权限验证，但是会将连接恢复到刚刚创建完的时候。

#### 查询缓存

这个功能 MySQL 5.7.20 就弃用了，8.0 溢出了，有兴趣的请看, [The MySQL Query Cache](https://dev.mysql.com/doc/refman/5.7/en/query-cache.html)。

#### 分析器

在执行语句之前，MySQL 首先必须知道本次操作的意图，所以需要对 SQL 做解析，分析器会做词法分析，分析输入的由空格组成的每个字符串代表什么。例如，当你输入查询语句：`select ID from T`，MySQL 会从这个语句根据 select 识别出这是一个查询语句，将 ID 翻译成表 T 的一个列。做完了这些识别之后，MySQL 就要做语法分析，语法分析根据语法规则，判断输入的SQL语句是否满足 MySQL 语法。

如果输入不对，大概就是下面这样的一个提示：**ERROR 1064 (42000): You have an error in your SQL syntax;**。

#### 优化器

经过分析器的意图识别之后，MySQL 就知道你要做什么了，在开始执行之前，还要优化一下，比如在表里面有多个索引的时候决定使用哪个索引，或者在一个语句有多表关联的时候，决定各个表的连接顺序。比如在执行下面这个语句的时候：

    mysql> select * from t1 join t2 using(ID)  where t1.c=10 and t2.d=20;

- 既可以先从表 t1 里面取出 c=10 的记录的 ID 值，再根据 ID 值关联到表 t2，再判断 t2 里面 d 的值是否等于 20。
- 也可以先从表 t2 里面取出 d=20 的记录的 ID 值，再根据 ID 值关联到 t1，再判断 t1 里面 c 的值是否等于 10。

这两种的方案的逻辑结果是一致的，但是执行的效率会有所不同，而优化器的作用就是选择最优方案。优化器优化之后，执行方案就确定下来了，接下来就是交给执行器执行查询。

#### 执行器

经过前面的步骤，MySQL 已经知道你要做什么，紧接着就是执行语句，但是开始执行之前，要先判断一下当前连接的用户对这个表有没有执行的权限，没有就会返回没有权限的错误：

    mysql> select * from T where ID=10;

    ERROR 1142 (42000): SELECT command denied to user 'b'@'localhost' for table 'T'

如果有权限，就打开表，根据之前已经制定好的查询计划去调用这个表存储引擎的接口读取数据，比如如果上面的例子中，如果 表 T 中 ID 列没有索引，那么执行操作如下：

1. 调用 InnoDB 引擎接口取这个表的第一行，判断 ID 值是不是 10，如果不是则跳过，如果是则将这行存在结果集中；
2. 调用引擎接口取“下一行”，重复相同的判断逻辑，直到取到这个表的最后一行。
3. 执行器将上述遍历过程中所有满足条件的行组成的记录集作为结果集返回给客户端。

到这里，就算是这个语句执行完了。

### 日志系统

前面讨论过，一条查询语句的执行流程的过程，那么 UPDATE 语句的过程又有何不同？其实，查询语句的过程更新语句都会走一遍，除此之外，更新流程还涉及两个重要的日志模块：redo log（重做日志）和 binlog （归档日志）。[MySQL Server Logs](https://dev.mysql.com/doc/refman/5.7/en/server-logs.html)。


#### [重做日志（redo log）](https://dev.mysql.com/doc/refman/5.7/en/innodb-redo-log.html) 物理日志

在 MySQL 中，并不是每一次更新都会写入磁盘，因为如果这样做，就得涉及到从磁盘找到那条记录，然后更新，整个 IO 成本，查找成本相当高。为了解决这个问题，MySQL 设计者使用了一种叫做 WAL （Write-Ahead-Logging）的技术，它的关键点技术先写日志，再写磁盘。具体来说，当有一条记录需要更新的时候， InnoDB 引擎会把记录写到 redo log 里，并且更新内存，这个时候就算更新完成了。同时，InnoDB 引擎会在适当的时候，将这个记录更新到磁盘，而这个更新操作往往是在系统比较空闲的时候。

InnoDB 的 redo log 是固定大小的，由变量 [innodb_log_file_size](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_log_file_size) 和 [innodb_log_files_in_group](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#innodb_log_files_in_group) 设置，默认是2个48GBd的文件，它被设定为从头开始写，写到末尾由从头循环写，如下图所示：

![redo-log](redo-log.png)

write pos 记录当前的位置，一边写一遍后移，写到第3号我呢就爱你末尾后就回到第0号文件开头，checkpoint 是当前要查出的位置，也是往后推移并且循环的，擦除记录前要把记录更新到磁盘。write pos 和 checkpoint 之间的绿色位置表示可以用来记录新的操作。如果 write pos 追上 checkpoint，这个时候不再执行更新操作，需要停下来擦掉一部分记录，腾出空间。

有了 redo-log，InnoDB 就可以做到即使数据库异常重启，之前提交的记录也不会丢失，这个能力称之为 crash-safe。

#### 归档日志 (Binary Log) 逻辑日志

MySQL 从整体架构上来说，分为 Server 层和存储层，前者负责 MySQL 功能相关，后者负责数据存储。前面所说的 redo-log 就是 InnoDB 引擎特有的日志，而 Server 层也有自己的日志，叫做 [Binary Log](https://dev.mysql.com/doc/refman/5.7/en/binary-log.html)，简称：binlog。

会有两份日志的重要原因是最开始 MySQL 里并没有 InnoDB 引擎。MySQL 自带的引擎是 MyISAM，但是 MyISAM 没有 crash-safe 的能力，binlog 日志只能用于归档。而 InnoDB 是另一个公司以插件形式引入 MySQL 的，既然只依靠 binlog 是没有 crash-safe 能力的，所以 InnoDB 使用另外一套日志系统——也就是 redo log 来实现 crash-safe 能力。

对比下这两个日志的不同点：

1. redo log 是 InnoDB 引擎特有的；binlog 是 MySQL 的 Server 层实现的，所有引擎都可以使用。
2. redo log 是物理日志，记录的是“在某个数据页上做了什么修改”；binlog 是逻辑日志，记录的是这个语句的原始逻辑，比如“给 ID=2 这一行的 c 字段加 1 ”。
3. redo log 是循环写的，空间固定会用完；binlog 是可以追加写入的。“追加写”是指 binlog 文件写到一定大小后会切换到下一个，并不会覆盖以前的日志。

我们再看 执行器和 InnoDB 是如何处理这个 SQL的： `update T set c=c+1 where ID=2;`

1. 执行器先找引擎取 ID=2 这一行。ID 是主键，引擎直接用树搜索找到这一行。如果 ID=2 这一行所在的数据页本来就在内存中，就直接返回给执行器；否则，需要先从磁盘读入内存，然后再返回。
2. 执行器拿到引擎给的行数据，把这个值加上 1，比如原来是 N，现在就是 N+1，得到新的一行数据，再调用引擎接口写入这行新数据。
3. 引擎将这行新数据更新到内存中，同时将这个更新操作记录到 redo log 里面，此时 redo log 处于 prepare 状态。然后告知执行器执行完成了，随时可以提交事务。
4. 执行器生成这个操作的 binlog，并把 binlog 写入磁盘。
5. 执行器调用引擎的提交事务接口，引擎把刚刚写入的 redo log 改成提交（commit）状态，更新完成。

![log-commit](log-commit.png)

有了 binlog，即使在误删数据之后，结合备份数据库，可以做到数据恢复。例如，如果我们的数据库一天一次备份，保留15天之内的 binlog，那么按道理说我们可以恢复到半个月以内的任意一个时间点。日志提交分为两个阶段，主要是为了防止在日志提交期间，MySQL 奔溃恢复，binlog 和 redolog 不一致，在使用 binlog 恢复数据的时候，造成数据不一致。

另外，建议将参数 [innodb_flush_log_at_trx_commit](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit) 和 [sync_binlog](https://dev.mysql.com/doc/refman/5.7/en/replication-options-binary-log.html#sysvar_sync_binlog) 都设置为1，表示在每次事务提交的时候，将 redolog 和 binlog 都持久化到磁盘。


### 事务隔离

事务就是要保证一组数据库操作要么全部成功，要么全部失败，MySQL 中，事务支持是在引擎层实现的，MySQL 支持多引擎，但是并非所有引擎都支持事务。比如原生的 MyISAM 并不支持事务，这也是它被取代的原因之一。

用于说明的常用例子转账，A 要给 B 转账 100元，涉及两个操作，A 的账户减 100，B 的账户加 100，这两个操作要么全部成功，要么就全部失败，否则 A 的账户减了 100，B 的账户没加，那就不好了。

#### 隔离性与隔离级别

提到事务，肯定会想到 [ACID](https://dev.mysql.com/doc/refman/5.7/en/glossary.html#glos_acid)，即（Atomicity，Consistency，Isolation，Durability，分别表示 原子性，一致性，隔离性，持久性），分别解释如下：

- Atomicity：一个事务（transaction）中的所有操作，或者全部完成，或者全部不完成，不会结束在中间某个环节。事务在执行过程中发生错误，会被回滚（Rollback）到事务开始前的状态，就像这个事务从来没有执行过一样。即，事务不可分割、不可约简。

- 一致性：在事务开始之前和事务结束以后，数据库的完整性没有被破坏。

- 隔离性：数据库允许多个并发事务同时对其数据进行读写和修改的能力，隔离性可以防止多个事务并发执行时由于交叉执行而导致数据的不一致。事务隔离分为不同级别，包括读未提交（Read uncommitted）、读提交（read committed）、可重复读（repeatable read）和串行化（Serializable）。

持久性：事务处理结束后，对数据的修改就是永久的，即便系统故障也不会丢失。

当数据库中有多个事务同时执行的时候，就能出现脏读，不可重复读，幻读的问题，为了解决这些问题，就有了事务[隔离级别](https://dev.mysql.com/doc/refman/5.7/en/innodb-transaction-isolation-levels.html)的概念。SQL 标准中的[事务隔离级别](https://dev.mysql.com/doc/refman/5.7/en/glossary.html#glos_isolation_level)包括：**读未提交（READ UNCOMMITTED）、读提交（READ COMMITTED）、可重复读（REPEATABLE READ）、串行化（SERIALIZABLE）**，释义如下：

- 读未提交：一个事务还没提交时，它做的变更就能被别的事务看到；
- 读提交：一个事务提交之后，它做的变更才能被其它事务看到；
- 可重复读：一个事务执行过程中看到的数据总是跟这个事务在启动的时候看到的数据时一致的，在此级别下，未提交变更对其他的事务也是不可见的；
- 串行化：对于同一行记录，读写操作分别会加读写锁，当读写锁冲突的时候，后访问的事务必须等待前一个事务执行完成，才能继续执行。

查看当前事务隔离级别，查看变量 [tx_isolation](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_tx_isolation)：`show variables like "tx_isolation"`， 设置事务隔离级别，请阅读 [https://dev.mysql.com/doc/refman/5.7/en/set-transaction.html](https://dev.mysql.com/doc/refman/5.7/en/set-transaction.html)。


#### 事务启动方式

事务启动方式有如下几种：

1. 显示启动事务，使用语句 `begin` 或者 `start transaction`，对应的提交语句是 `commit`，回滚语句是 `rollback`。详见：[https://dev.mysql.com/doc/refman/5.7/en/commit.html](https://dev.mysql.com/doc/refman/5.7/en/commit.html)。
2. `set autocommit=0;`，这个命令会令这个线程的自动提交关掉，意味着如果你只执行一个 select 语句这个事务就启动了，而且不会自动提交。这个事务会持续存在知道你主动 commit，rollback 或者 断开连接。

有些客户端框架会默认在连接成功后先执行一个 `set autocommit=0`，这导致接下来的查询都在事务中，如果是长连接，就会导致意外的长事务。，导致大量的回滚日志产生。

可以在 information_schema.innodb_trx 这个表中查询长事务，比如下面这个语句，查询持续时间超过 60s 的事务：

        select * from information_schema.innodb_trx where TIME_TO_SEC(timediff(now(),trx_started))>60


### 索引

**索引的出现就是为了提高数据的查询效率，承担书籍目录的功能**。实现索引的方式有很多中，所以就有了索引模型的概念，可以用于提高读写效率的数据结构很多，例如：哈希表，有序数组和搜索树。但是哈希表这种数据结构只支持等值查询，而有序数组虽然在等值查询和范围查询中表现很不错，但是却在插入的时候变得很麻烦，而二叉搜索数作为课本中的经典数据结构，他可以将读写的时间复杂度都控制在 O(logn) 以内，不过在MySQL中，索引不仅仅是在内存中存储，还有持久化到磁盘，使用二叉搜索树存储，记录越多，数的高度就越大，导致读写磁盘的次数就增加，因为就出现了 N 叉树。以 InnoDB 为例，这个 N 差不多是 1200，因此当数的高度是4的时候，就可以存储 17亿 的数据量了，这种 N 叉叉树已经被广泛用于数据库引擎中。

#### InnoDB 索引模型

InnoDB 中，表都是根据逐渐以索引的形式存放的，这种存储方式被称为索引组织表，InnoDB 使用了 B+ 树索引模型，所以数据都是存放在 B+ 树中的。每一个在 InnoDB 中对应一颗 B+ 树。

假设，我们有一个主键列为 ID 的表，表中有字段k，并且在 k 上有索引。这个表的创建语句如下：

      mysql> create table T(
        id int primary key, 
        k int not null, 
        name varchar(16),
        index (k))engine=InnoDB;
  
表中 R1~R5 的 (ID,k) 值分别为 (100,1)、(200,2)、(300,3)、(500,5) 和 (600,6)，两棵树的示例示意图如下。

![索引示例](2.png)

从图中看出，索引类型分为主键索引和非主键索引，主键索引叶子节点的内容是整行的数据，InnoDB 中，主键索引也被成为聚簇索引。非主键索引叶子节点的内容是主键的值，InnoDB 中，非主键索引也被称为二级索引。

因此在查询的时候，基于主键索引的查询只需查询一棵树，而基于非主键索引的数据要多查询一棵树。

B+ 树为了维护索引有序性，在插入新值的时候需要做必要的维护。以上面这个图为例，如果插入新的行 ID 值为 700，则只需要在 R5 的记录后面插入一个新记录。如果新插入的 ID 值为 400，就相对麻烦了，需要逻辑上挪动后面的数据，空出位置。

而更糟的情况是，如果 R5 所在的数据页已经满了，根据 B+ 树的算法，这时候需要申请一个新的数据页，然后挪动部分数据过去。这个过程称为页分裂。在这种情况下，性能自然会受影响。除了性能外，页分裂操作还影响数据页的利用率。原本放在一个页的数据，现在分到两个页中，整体空间利用率降低大约 50%。当然有分裂就有合并。当相邻两个页由于删除了数据，利用率很低之后，会将数据页做合并。合并的过程，可以认为是分裂过程的逆过程。

为了减少索引维护的成本，所以我们一本看到这样的建表规范：**表必须包含自增主键**，自增主键是指在自增列上定义的主键，在建表语句中一般这样描述：`NOT NULL PRIMARY KEY AUTO_INCREMENT`，插入记录的时候，可以不用指定这个自增列的值，系统会自动获取自增列的最大值并且加1作为下一条记录该列的值。

而当使用有业务逻辑的字段做主键，则往往不容易保证有序插入，这样会增加写数据的成本。除了性能之外，我们还可以从存储空间的角度来考虑，假设表中确实有一个唯一字段，比如字符串类型的身份证号，那应该用身份证号做主键还是自增字段呢？由于每个非主键索引树中叶子节点上都是主键的值，如果用身份证号做主键，则需要20个字节的，如果用整形做主键，只要4个字节。**显然，主键长度越小，普通索引叶子节点就越小，普通索引占用的空间就越小**。因此，从性能和存储空间来考虑，自增主键往往是更合理的选择。然而，当在用于缓存形式的 KV 表中，由于表只包含一个唯一索引，所以使用业务字段做主键更为划算。

在重建索引的时候，重建普通索引可以按如下的流程操作：

    alter table T drop index;
    alter table T add index(k);

重建主键索引则需要，因为删除或者创建主键都会重建表，按照普通索引的重建做法，第一个流程就白执行了：

    alter table T engine=InnoDB;

#### 覆盖索引

基于前面的讨论，继续探讨对于下下面这个表：

        mysql> create table T (
        ID int primary key,
        k int NOT NULL DEFAULT 0, 
        s varchar(16) NOT NULL DEFAULT '',
        index k(k))
        engine=InnoDB;

        insert into T values(100,1, 'aa'),(200,2,'bb'),(300,3,'cc'),(500,5,'ee'),(600,6,'ff'),(700,7,'gg');

在执行语句 `select * from T where k between 3 and 5` 时，是按照下面的顺序操作的：

1. 在以 k 列值构建的索引上找到 k=3 的记录，取得 ID=300;
2. 再到 ID 索引数上找到 ID=300 对应的行；
3. 在 k 索引树取下一个值 k=5，取得 ID=500；
4. 再回到 ID 索引树查到 ID=500 对应的行；
5. 在 k 索引树取下一个值 k=6，不满足条件，结束。

这个过程中，回到主键索引树搜索的过程，我们称为回表，这个例子中，由于要查询的数据只有在主键上有，所以不得不回表。那么应该如何避免回表呢？如果执行的语句是 `select ID from T where k between 3 and 5`，因为 ID 的值已经在 k 索引树上了，所以就不用回表了，换句话说，这个查询里面，索引 k 已经 **覆盖** 了我们的查询需求，因此我们称索引 k 为覆盖索引。

**由于覆盖索引可以减少树的搜索次数，显著提升查询性能，所以使用覆盖索引是一个常用的性能优化手段。**

基于上面覆盖索引的说明，我们讨论一个问题：在一个市民信息表中，是否有必要将身份证号和名字字段建立联合索引？

    CREATE TABLE `tuser` (
    `id` int(11) NOT NULL,
    `id_card` varchar(32) DEFAULT NULL,
    `name` varchar(32) DEFAULT NULL,
    `age` int(11) DEFAULT NULL,
    `ismale` tinyint(1) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `id_card` (`id_card`),
    KEY `name_age` (`name`,`age`)
    ) ENGINE=InnoDB

身份证号是市民的唯一标识，也就是说，如果有根据身份证号查询市民信息的需求，只要在身份证字段上建立索引就够了。而再建立一个联合索引（身份证号，姓名），是否浪费空间？但是，如果现在有需要根据身份证号查询姓名的需求，那么这个索引就变的有意义了，不用回表。但是，建立这种冗余覆盖索引，势必影响写入的效率以及加大存储空间消耗。

#### 最左前缀

承接上面，如果我们要再根据身份证号查询家庭住址，然后再建立一个覆盖索引（身份证号，家庭住址），那样就太。。。。不过我们可以利用 **索引的最左前缀来定位记录**，减少创建索引。为了说明这个概念，我们用 (name, age) 这个联合索引分析。

![索引](3.png)

可以看到，索引项是按照索引定义里面出现的字段顺序排序的。当你的逻辑需求是查到所有名字是“张三”的人时，可以快速定位到 ID4，然后向后遍历得到所有需要的结果。如果你要查的是所有名字第一个字是“张”的人，你的 SQL 语句的条件是"where name like ‘张 %’"。这时，你也能够用上这个索引，查找到第一个符合条件的记录是 ID3，然后向后遍历，直到不满足条件为止。可以看到，不只是索引的全部定义，只要满足最左前缀，就可以利用索引来加速检索。这个最左前缀可以是联合索引的最左 N 个字段，也可以是字符串索引的最左 M 个字符。

所以，我们在建立联合索引的时候，索引字段的顺序显得比较重要了，如果通过调整顺序就能少维护一个索引，那么这个顺序应该优先采用。所以前面的问题中，联合索引（身份证号，姓名）就能支持 “根据身份真好查住址” 这个需求了。但是如果在有联合索引（a,b）的情况下，又有基于 a,b 各自的查询的时候，是需要单独为 b 创建索引的，也就是说，需要同时维护 (a,b) 和 (b) 这两个索引。

MySQL 5.6 引入了 [索引下推（ICP）](https://dev.mysql.com/doc/refman/5.7/en/index-condition-pushdown-optimization.html)，对基于最左前缀匹配的查询做了查询优化。

#### 普通索引和唯一索引的选择

我们将通过分析普通索引和唯一索引对查询和更新操作性能的影响来得出结论。

##### 查询过程

假设执行的查询语句是 `select id from T where k=5`，这个查询语句在索引树上查找的过程，先是通过 B+ 树从树根开始，按层搜索到叶子节点，然后可以再数据页内通过二分法来定位记录：

- 对于普通索引来说，查到满足条件的第一个记录之后，需要查找下一个记录，知道碰到第一个不满足 k=5 条件的记录；
- 对于唯一索引来说，由于索引定义了唯一性，查找到第一个满足条件的记录后，就会停止检索；

由于 InnoDB 的读写是按照数据页为单位进行读写的，也就是说，当需要读一条记录的时候，并不只是将这条记录从磁盘读出来，而是以页为单位，将其整体读入内存。在 InnoDB 中，每个数据页的大小是 16KB，所以就查询来说，二者的差距不大，对于普通索引来说，就是多了指针向下查询的过程。当然，如果 k=5 恰好是这个数据页最后的一个记录，那么取下一条记录，就需要读取下一个数据页，这个操作会稍微复杂一些。但是我们之前计算过，一个数据页可以存放近千个 key，因此出现这种情况的概率会很低。

##### 更新过程

在对比普通索引和唯一索引对更新语句性能影响的问题之外，先来看一个东西，[change buffer](https://dev.mysql.com/doc/refman/5.7/en/innodb-change-buffer.html)。当需要更新一个数据页时，如果数据页在内存中就直接更新，而如果这个数据页还没有在内存中的话，在不影响数据一致性的前提下，InooDB 会将这些更新操作缓存在 change buffer 中，这样就不需要从磁盘中读入这个数据页了。在下次查询需要访问这个数据页的时候，将数据页读入内存，然后执行 change buffer 中与这个页有关的操作。通过这种方式就能保证这个数据逻辑的正确性。将 change buffer 中的操作应用到原数据页，得到最新结果的过程称为 merge。除了访问这个数据页会触发 merge 外，系统有后台线程会定期 merge。在数据库正常关闭（shutdown）的过程中，也会执行 merge 操作。显然，如果能够将更新操作先记录在 change buffer，减少读磁盘，语句的执行速度会得到明显的提升。而且，数据读入内存是需要占用 buffer pool 的，所以这种方式还能够避免占用内存，提高内存利用率。

那么什么条件下能够使用 change buffer 呢？

对于唯一索引来说，所有的更新操作都要先判断这个操作是否违反唯一性约束。比如，要插入 (4,400) 这个记录，就要先判断现在表中是否已经存在 k=4 的记录，而这必须要将数据页读入内存才能判断。如果都已经读入到内存了，那直接更新内存会更快，就没必要使用 change buffer 了。**因此，唯一索引的更新就不能使用 change buffer，实际上也只有普通索引可以使用。**change buffer 用的是 buffer pool 里的内存，因此不能无限增大。change buffer 的大小，可以通过参数 [innodb_change_buffer_max_size](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_change_buffer_max_size) 来动态设置。这个参数设置为 50 的时候，表示 change buffer 的大小最多只能占用 buffer pool 的 50%。

了解了 change buffer 的机制，我们探究一下在这种插入一条记录的过程？

1. 如果这个记录要更新的目标页在内存中。这时 InnoDB 处理的逻辑如下：

    - 对于唯一索引，找到 3 和 5 之间的位置，判断没有冲突，插入这个值，语句执行结束；
    - 对于普通索引，找到 3 和 5 之间的位置，插入这个值，语句执行结束。

    这种情况下，普通索引和唯一索引对更新语句的性能影响差别只有一个判断。

2. 如果这个记录要更新的目标页不在内存中，这时，InnoDB 处理逻辑如下：

    - 对于唯一索引。需要将数据页读入内存，判断有没有冲突，插入新值，结束；
    - 对于普通索引，则是将更新记录在 change buffer 中，语句执行结束；

将数据从磁盘读入内存涉及随机 IO 的访问，是数据库里面成本最高的操作之一。change buffer 因为减少了随机磁盘访问，所以对更新性能的提升是会很明显的。

###### change buffer 使用场景

基于前面的介绍，change buffer 能加锁所有使用普通索引的场景吗？

因为 merge 的时候是真正进行数据更新的时刻，而 change buffer 的主要目的就是将记录的变更动作缓存下来，所以在一个数据页做 merge 之前，change buffer 记录的变更越多（也就是这个页面上要更新的次数越多），收益就越大。**因此，对于写多读少的业务来说，页面在写完以后马上被访问到的概率比较小，此时 change buffer 的使用效果最好**。这种业务模型常见的就是账单类、日志类的系统。反过来，假设一个业务的更新模式是写入之后马上会做查询，那么即使满足了条件，将更新先记录在 change buffer，但之后由于马上要访问这个数据页，会立即触发 merge 过程。这样随机访问 IO 的次数不会减少，反而增加了 change buffer 的维护代价。所以，对于这种业务模式来说，change buffer 反而起到了副作用。

##### 索引选择总结

普通索引和唯一索引在查询能力上没差别的，主要考虑的是对更新性能的影响，因此建议尽量使用普通索引。如果所有的更新后面，都马上伴随着对这个记录的查询，那么你应该关闭 change buffer。而在其他情况下，change buffer 都能提升更新性能。在实际使用中，你会发现，普通索引和 change buffer 的配合使用，对于数据量大的表的更新优化还是很明显的。

#### 字符串字段添加索引

加入我们的用户表中有两个 email 字段，我们在使用过程发现需要根据 email 查询用户，为了避免全表扫面，我们需要为这个字段添加索引，有两种方式：

    mysql> alter table SUser add index index1(email);
    或者
    mysql> alter table SUser add index index2(email(6));

前者创建的索引里面，使用了整个 email，后者只使用了 email 的前6个字符，这两种创建索引的方式对于创建的索引大小有直接影响，很明显前者更大，但是后者虽然减小了索引结构中 key 的大小，使得降低存储空间，但是在查询时会增加额外的扫描次数。接下来我们看看下面这个查询语句是如何执行的：

    select id,name,email from SUser where email='zhangssxyz@xxx.com';

如果使用的是 index1（即 email 整个字符串的索引结构），执行顺序是这样的：

1. 从 index1 索引树找到满足索引值是’zhangssxyz@xxx.com’的这条记录，取得 ID2 的值；
2. 到主键上查到主键值是 ID2 的行，判断 email 的值是正确的，将这行记录加入结果集；
3. 取 index1 索引树上刚刚查到的位置的下一条记录，发现已经不满足 email='zhangssxyz@xxx.com’的条件了，循环结束。

这个过程中，只需要回主键索引取一次数据，所以系统认为只扫描了一行。

如果使用的是 index2（即 email(6) 索引结构），执行顺序是这样的：

1. 从 index2 索引树找到满足索引值是’zhangs’的记录，找到的第一个是 ID1；
2. 到主键上查到主键值是 ID1 的行，判断出 email 的值不是’zhangssxyz@xxx.com’，这行记录丢弃；
3. 取 index2 上刚刚查到的位置的下一条记录，发现仍然是’zhangs’，取出 ID2，再到 ID 索引上取整行然后判断，这次值对了，将这行记录加入结果集；
4. 重复上一步，直到在 idxe2 上取到的值不是’zhangs’时，循环结束。

通过这个对比，你很容易就可以发现，使用前缀索引后，可能会导致查询语句读数据的次数变多。实质上使用前缀索引，定义好长度，就可以做到既节省空间，又不用增加太多的查询成本。那么在给前缀字符串创建索引的时候，前缀长度如何确定？这里我们就要用到一个叫做**区分度**的指标了，区分度越高，重复的简直越少。因此，我们可以通过统计索引上有多少个不同的值来判断使用多长的前缀，例如我们可以这样对比：

    mysql> select 
    count(distinct left(email,4)）as L4,
    count(distinct left(email,5)）as L5,
    count(distinct left(email,6)）as L6,
    count(distinct left(email,7)）as L7,
    from SUser;

前缀索引还有另外一个缺点，就是 **可能会使覆盖索引优化失效**，例如查询 `select id,email from SUser where email='zhangssxyz@xxx.com';` 在使用前置索引的时候还得回表查询email。我们在对字符串字段添加索引的时候，还可以通过倒序，求hash值的方式使得较小的长度就能获得更大区分度的方式来优化。


#### explain 查询计划


### 锁

数据库锁设计的初衷是处理并发问题，作为多用户共享的资源，当出现并发访问的时候，数据库是需要合理地控制资源的访问规则，而锁就是来实现这些访问规则的重要数据结构。根据加锁的范围，MySQL 里面锁的可以分为全局锁，表级锁和行锁三类。官方文档请读：

1. [InnoDB Locking](https://dev.mysql.com/doc/refman/5.7/en/innodb-locking.html)
2. [LOCK TABLES and UNLOCK TABLES Syntax](https://dev.mysql.com/doc/refman/5.7/en/lock-tables.html)
3. [Metadata Locking](https://dev.mysql.com/doc/refman/5.7/en/metadata-locking.html)

#### 全局锁

全局锁就是对整个数据库实例加锁，MySQL提供了一个加全局读锁的方法，命令式：[`flush tables with read lock`(FTWRL)](https://dev.mysql.com/doc/refman/5.7/en/flush.html#flush-tables-with-read-lock)。当你让整个库处于只读状态的时候，可以使用这个命令，之后其他线程的以下语句会被阻塞：数据更新语句（数据的增改删）、数据定义语句（包括建表，修改表结构等）和更新类事务的提交语句。

全局库的典型使用场景是，做全库逻辑备份，也就是把整库每个表都 select 出来成文本。让个库都处于只读状态是很危险的：

1. 如果在主库上做备份，那么备份期间都不能执行更新，业务基本上就得停摆；
2. 如果在从库上备份，那么备份期间从库不能执行主库同步过来的 binlog，会导致主从延迟。

为了解决 FTWRL 期间不能写入的问题，MySQL 有用于做逻辑备份的工具：[mysqldump](https://dev.mysql.com/doc/refman/5.7/en/mysqldump.html)，当 mysqldump 使用 [--single-transaction](https://dev.mysql.com/doc/refman/5.7/en/mysqldump.html#option_mysqldump_single-transaction) 参数的时候，导数据之前会启动事务，并且设置隔离级别为可重复读，而由于 MVCC 的支持，这个过程中数据是可以正常更新的。但是这个需要引擎支持这个隔离级别，所以，`single-transaction` 方法适用于所有表使用事务引擎的库。如果有的表使用了不支持事务的引擎，那么备份就只能通过 FTWRL 的方法，这也是替换 MyISAM 为了 InnoDB 的原因之一。除了 FTWRL 的方法之外，还可以配置 InnoDB 用于只读，详见 [Configuring InnoDB for Read-Only Operation](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_read_only)。可以使用命令 `unlock tables` 释放 FTWRL 添加的全局读锁。


#### 表级锁

MySQL 有两种表级锁，一种是表锁，一种是元数据锁（meta data lock, MDL）。

锁表的语法请看 [LOCK TABLES and UNLOCK TABLES Syntax](https://dev.mysql.com/doc/refman/5.7/en/lock-tables.html) 。与 FTWRL 类似，可以使用 `unlock tables` 主动释放锁，也可以在客户端断开的时候释放锁。需要注意的是，lock tables 除了限制别的线程读写外，也限定了本线程接下来的操作对象。举个例子来说，如果在某个线程中执行 `lock table t1 read, t2 write`，那么其他线程写 t1，读 t2 都会被阻塞，同时，在线程A执行 `unlock tables` 命令之前，也只能读 t1, 写 t2。在还没有更细粒度锁出现的时候，锁表是常用的处理并发方式。对于 InnoDB 这种支持行锁的引擎来说，一般不使用 lock tables 命令控制并发。

另一类表级锁是 **MDL（meta data lock）**，MDL 不需要显示使用，在访问换一个表的时候会自动加上，作用是保证读写的正确性。想象一下，如果一个查询正在遍历一个表中的数据，而执行期间另一个线程对这个表结构做更改，删了一列，肯定是不行的。

MySQL 5.5 版本中引入了 MDL，当对一个表做增删改查的时候，加 MDL 读锁，当要做对表结构变更的操作的时候，加 MDL 写锁。

- 读锁之间不互斥，因此可以多线程对同一张表增删改查；
- 读写锁之间，写锁之间是互斥的，是用来保证表结构的安全性。如果有两个线程同时给一个表加字段，其中一个要等另一个执行完才能执行；

虽然 MDL 锁是系统默认会加的，但却是你不能忽略的一个机制。比如下面这个例子，我经常看到有人掉到这个坑里：给一个小表加个字段，导致整个库挂了。你肯定知道，给一个表加字段，或者修改字段，或者加索引，需要扫描全表的数据。在对大表操作的时候，你肯定会特别小心，以免对线上服务造成影响。而实际上，即使是小表，操作不慎也会出问题。我们来看一下下面的操作序列，假设表 t 是一个小表。

> 环境：MySQL 5.6

![MDL 读锁](4.jpg)

我们可以看到 session A 先启动，这时候会对表 t 加一个 MDL 读锁。由于 session B 需要的也是 MDL 读锁，因此可以正常执行。之后 session C 会被 blocked，是因为 session A 的 MDL 读锁还没有释放，而 session C 需要 MDL 写锁，因此只能被阻塞。如果只有 session C 自己被阻塞还没什么关系，但是之后所有要在表 t 上新申请 MDL 读锁的请求也会被 session C 阻塞。前面我们说了，所有对表的增删改查操作都需要先申请 MDL 读锁，就都被锁住，等于这个表现在完全不可读写了。如果某个表上的查询语句频繁，而且客户端有重试机制，也就是说超时后会再起一个新 session 再请求的话，这个库的线程很快就会爆满。你现在应该知道了，事务中的 MDL 锁，在语句执行开始时申请，但是语句结束后并不会马上释放，而会等到整个事务提交后再释放。

那如何安全地给小表加字段？

1. 首先解决掉长事务，事务不提交，一致会占着 MDL 读锁，在 MySQL 的 information_schema 库的 innodb_trx 中，可以查询到当前执行中的事务。如果要做 DDL的表刚好有长事务在执行， 应该考虑先暂停 [DDL](https://dev.mysql.com/doc/refman/5.7/en/innodb-online-ddl-performance.html)，或者 kill 掉这个长事务。

2. 但是请求频繁的小表，kill 未必能管用，比较理想的机制是，在 alter table 语句里面设定等待时间，如果在这个指定的等待时间里能够拿到 MDL 写锁最好，拿不到也不到阻塞后面业务的语句，先放弃，后面开发人员或者 DBA 再重试。

[MarIDB](https://mariadb.org/) 已经合并了 AliSQL 的这个功能，这两个开源分支都支持 [DDL NOWAIT/WAIT](https://mariadb.org/2017-mariadb-foundation/) 语法：

    ALTER TABLE tbl_name NOWAIT add column ...
    ALTER TABLE tbl_name WAIT N add column ... 


#### 行锁

行锁是在存储引擎层由各个存储引擎自己实现的，但是并非所有的存储引擎都支持，MyISAM 引擎就不支持行锁。不支持行锁意味着并发控制只能考表级锁，对于使用这种引擎的表，同一张表同一个时刻只能有一个更新在执行，这回影响业务并发度。InnoDB 支持行锁，这也是被作为默认引擎的原因之一。

行锁就是针对数据表中行记录的锁，这个很好理解，比如事务 A 更新了一行，而这个时候 B 事务也要更新这一行，那么必须等待 A 事务执行完成后才能进行。

对于下面的例子，事务 B 的执行会是什么样子呢？（假设 id 是表 t 的主键）

|事务A|事务B|
|:---:|:--:|
|begin;<br>update t set k=k+1 where id=1;<br>update t set k=k+1 where id=12;||
||begin;<br>udate t set k=k+1 where id=1;|
|commit|...|

由于A事务在执行过程中持有两个记录的行锁，而且都是在 commit 的时候释放的。也就是说 **在 InnoDB 事务中，行锁是在需要的时候才加上的，但并不是不需要了就立刻释放，而是要等到事务结束才释放，这个就是两阶段协议**。基于这个设定，我们应该得出结论，**如果你的事务中需要锁多个行，要把最可能造成锁冲突，最可能影响并发度的锁尽量往后放**。

##### 死锁和死锁检测

当并发系统中不同线程出现资源循环依赖，涉及的线程都在等待别的线程释放资源的时，就会导致这几个线程都进入无限等待的时候，成为死锁，我们举个例子说明情况。

|事务A|事务B|
|:---:|:---:|
|begin;<br>update t set k=k+1 where id=1;|begin;|
||update t set k=k+1 where id=2;|
|update t set k=k+1 where id=2;||
||update t set k=k+1 where id=1;|

这个时候，A事务在等待B事务释放 id=2 这行的锁，而 B事务在等待A事务释放 id=1 这行的锁，事务A和事务B互相等待对方的资源释放，就进入了死锁状态。当出现死锁以后，有两种策略：

- 直接进入等待，直到超时，超时时间通过参数 [innodb_lock_wait_timeout](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout) 控制。
- 发起死锁检测，发现出现死锁后，主动回滚死锁链条中的某一个事务，让其他事务得以继续执行，[innodb_deadlock_detect](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_deadlock_detect) 用于开启这个功能。

在 InnoDB 中，innodb_lock_wait_timeout 的默认值是 50s，意味着如果采用第一个策略，当出现死锁以后，第一个被锁住的线程要过 50s 才会超时退出，然后其他线程才有可能继续执行。对于在线服务来说，这个等待时间往往是无法接受的。但是，我们又不可能直接把这个时间设置成一个很小的值，比如 1s。这样当出现死锁的时候，确实很快就可以解开，但如果不是死锁，而是简单的锁等待呢？所以，超时时间设置太短的话，会出现很多误伤。所以，正常情况下我们还是要采用第二种策略，即：主动死锁检测，而且 innodb_deadlock_detect 的默认值本身就是 on。主动死锁检测在发生死锁的时候，是能够快速发现并进行处理的，但是它也是有额外负担的。每当一个事务被锁主的时候，就要看看它所依赖的线程有没有被别人锁住，如此循环，最后判断是否出现了循环等待，也就是死锁，这个过程在随着并发线程的增加，会消耗大量的 CPU 资源。对于这种热点数据更新的问题可以考虑将死锁检测临时关掉，或者控制并发度，以减少对 CPU 资源的消耗。

### 可重复读、[MVCC](https://dev.mysql.com/doc/refman/5.7/en/glossary.html#glos_mvcc)、[一致性读](https://dev.mysql.com/doc/refman/5.7/en/innodb-consistent-read.html)、当前读、行锁、幻读

基于前面介绍过的事务隔离级别，行锁，继续探讨 MySQL 一致性读方面的事情，继而引出当前读，MVCC 这个概念。

基于可重复读的事务隔离级别，事务 T 启动的时候会创建一个 read-view，之后事务T执行期间，即使其他事物做了修改，事务T看到也跟启动的时候一样，也就是说，可重复读隔离级别下的事务，好像与世无争。但是，在行锁中我们又介绍到，一个事物要更新一行，如果刚好有事务拥有这一行的行锁，它就会被锁住，进入等待状态。问题是，等待结束之后，这个事务有权更新这个数据的时候，它读到的值又是什么样的呢？

举个例子说明：

    mysql> CREATE TABLE `t` (
        `id` int(11) NOT NULL,
        `k` int(11) DEFAULT NULL,
        PRIMARY KEY (`id`)
        ) ENGINE=InnoDB;
        insert into t(id, k) values(1,1),(2,2);

|事务A|事务B|事务C|
|:---:|:---:|:---:|
|begin;<br>start transaction with consistent snapshot;|||
||start transaction with consistent snapshot;||
|||update t set k=k+1 where id = 1;（假设开启了自动提交）|
||update t set k=k+1 where id = 1;<br>select k from t where id = 1;||
|select k from t where id = 1;<br>commit;|||
||commit;|&nbsp;|

需要注意的是，`start transaction` 或者 `begin` 并不是一个事务真正的起点，在执行到他们之后的第一个操作的时候 InnoDB 的语句，事务才真正启动。如果想马上启动一个事务，可以使用 `start transction with consistent snapshot` 这个命令。这两个语句的区别如下：

- 第一种启动方式，一致性视图是在执行第一个快照读语句时创建的；
- 第二种启动方式，一致性读是在执行 start transction with consistent snapshot 时创建的；

我们先说结论，再做分析，B事务中查询得到的k值是3，A事务中查询得到k值是1。在 MySQL 中有两个视图的概念：

- 一个是 view，它是用一组查询语句创建的虚拟表，在调用的时候执行查询语句生成结果。创建试图的语法详见：[CREATE VIEW Syntax](https://dev.mysql.com/doc/refman/5.7/en/create-view.html)
- 另一个是 InnoDB 在实现 MVCC 时用到的一致性试图，即：consistent read view，用于支持 RC (READ COMMITTED) 和 RP（REPEATABLE READ）隔离级别的实现，没有物理结构，作用是事务执行期间用来定义 “我们能看到什么数据”。

#### 快照实现

可重复读隔离级别下，事务在启动的时候就 “拍了个快照”，注意这个快照是基于整库的，但是这个快照并不是将整个库复制备份，它是基于每个事务的 transaction id 实现的，每个事务在开启的时候都会向系统申请一个事务id。InnoDB 引擎中每行数据也是有多个版本的，每次事务更新数据的时候，都会生成一个新的数据版本，并且把 transaction id 赋值给这个数据版本的事务 ID，记为  row trx_id。同时，旧的数据版本要保留，并且在新的数据版本中，能够有信息可以直接拿到它。如下图所示，即使一个记录被多个事务连续更新后的结果：

![MVCC-1](5.png)

图中是一行数据的四个版本，当前最新版本是 v4,k 的值是 22，它是被 transaction id 为 25 的事务更新的，所以它的 row trx_id 是 25。语句更新的时候会生成 [undo log](https://dev.mysql.com/doc/refman/5.7/en/innodb-undo-logs.html)，图中的三个虚线箭头 U1,U2,U3 就是 undo log，而且，V1,V2,V3 也不是物理上真实存在的，而是在需要的时候根据当前版本和 undo log 计算出来的。例如，当需要 V2 的时候，就需要依次执行 U3，U2 算出来。

有了多版本和 row trx_id 以后，我们继续探讨 InnoDB 是如何生成快照的。按照可重复读的定义，一个事务启动的时候，能够看到所有已经提交的事务结果。但是之后，这个事务执行期间，其他事务的更新对它不可见。因此，一个事务只需要在启动的时候声明说，“以我启动的时刻为准，如果一个数据版本是在我启动之前生成的，就认；如果是我启动以后才生成的，我就不认，我必须要找到它的上一个版本”。当然，如果“上一个版本”也不可见，那就得继续往前找。还有，如果是这个事务自己更新的数据，它自己还是要认的。

在实现上， InnoDB 为每个事务构造了一个数组，用来保存这个事务启动瞬间，当前正在“活跃”的所有事务 ID。“活跃”指的就是，启动了但还没提交。数组里面事务 ID 的最小值记为低水位，当前系统里面已经创建过的事务 ID 的最大值加 1 记为高水位。这个视图数组和高水位，就组成了当前事务的一致性视图（read-view）。而数据版本的可见性规则，就是基于数据的 row trx_id 和这个一致性视图的对比结果得到的。这个视图数组把所有的 row trx_id 分成了几种不同的情况。

![MVCC-2](6.png)

这样，对于当前事务的启动瞬间来说，一个数据版本的 row trx_id，有以下几种可能：

- 如果落在绿色部分，表示这个版本是已提交的事务或者是当前事务自己生成的，这个数据是可见的；
- 如果落在红色部分，表示这个版本是由将来启动的事务生成的，是肯定不可见的；
- 如果落在黄色部分，那就包括两种情况
    - 若 row trx_id 在数组中，表示这个版本是由还没提交的事务生成的，不可见；
    - 若 row trx_id 不在数组中，表示这个版本是已经提交了的事务生成的，可见。

有了这个声明之后，系统里面随后发生的更新都与这个事务看到的内容无关，因为之后发生的更新要么基于2或者3(1)，而对它来说，这些数据版本是不存在的，所以这个事务的快照，就是静态的了。所以现在得出结论，**InnoDB 利用所有数据都有多个版本的特性，实现了快速创建快照的能力**。基于前面的解释，我们继续说明本章开头问题中为什么A事务中读取到的值是 k=1，我们做出如下假设：

- 事务 A 开始前，系统里面只有一个活跃事务 ID 是 99；
- 事务 A、B、C 的版本号分别是 100、101、102，且当前系统里只有这四个事务；
- 三个事务开始前，(1,1）这一行数据的 row trx_id 是 90。

这样，事务 A 的视图数组就是 `[99,100]`, 事务 B 的视图数组是 `[99,100,101]`, 事务 C 的视图数组是 `[99,100,101,102]`。为了简化分析，我先把其他干扰语句去掉，只画出跟事务 A 查询逻辑有关的操作：

![MVCC-3](7.png)

从图中可以看到，第一个有效更新是事务 C，把数据从 (1,1) 改成了 (1,2)。这时候，这个数据的最新版本的 row trx_id 是 102，而 90 这个版本已经成为了历史版本。第二个有效更新是事务 B，把数据从 (1,2) 改成了 (1,3)。这时候，这个数据的最新版本（即 row trx_id）是 101，而 102 又成为了历史版本。你可能注意到了，在事务 A 查询的时候，其实事务 B 还没有提交，但是它生成的 (1,3) 这个版本已经变成当前版本了。但这个版本对事务 A 必须是不可见的，否则就变成**脏读**了。好，现在事务 A 要来读数据了，它的视图数组是 `[99,100]`。当然了，读数据都是从当前版本读起的。所以，事务 A 查询语句的读数据流程是这样的：

- 找到 (1,3) 的时候，判断出 row trx_id=101，比高水位大，处于红色区域，不可见；
- 接着，找到上一个历史版本，一看 row trx_id=102，比高水位大，处于红色区域，不可见；
- 再往前找，终于找到了（1,1)，它的 row trx_id=90，比低水位小，处于绿色区域，可见。

这样执行下来，虽然期间这一行数据被修改过，但是事务 A 不论在什么时候查询，看到这行数据的结果都是一致的，所以我们称之为**一致性读**。所以，我们总结一下，一个数据版本，对于一个事务视图来说，除了自己的更新总是可见之外：

- 版本未提交，不可见；
- 版本已提交，但是是在视图创建后提交的，不可见；
- 版本已提交，而且是在视图创建前提交的，可见。

#### 更新逻辑

如果按照一致性读，那么事务B的执行结果好像不对哦？事务 B 的视图数组是先生成的，之后事务C才提交，不应该看不见（1，2）么，（1，3）是怎么来的呢？

![MVCC-4](8.png)

确实是这样的，如果事务 B 在执行之前查询一次数据，得到的结果确实是1，但是它要去更新的时候，就不能再在历史版本上更新了，否则事务C的更新就丢失了，所以，事务B是在（1,2）的基础上更新的。这里又有一条规则了：**更新数据都是先读后写的，而这个 “读”，只能读当前的值，称之为当前度读**。因此，在更新的时候，当前读拿到的数据是 (1,2)，更新后生成了新版本的数据 (1,3)，这个新版本的 row trx_id 是 101。所以，在执行事务 B 查询语句的时候，一看自己的版本号是 101，最新数据的版本号也是 101，是自己的更新，可以直接使用，所以查询得到的 k 的值是 3。这里我们提到了一个概念，叫作**当前读**。其实，除了 update 语句外，select 语句如果加锁，也是当前读。所以，如果把事务 A 的查询语句 select * from t where id=1 修改一下，加上 lock in share mode 或 for update，也都可以读到版本号是 101 的数据，返回的 k 的值是 3。下面这两个 select 语句，就是分别加了读锁（S 锁，共享锁）和写锁（X 锁，排他锁）。

    mysql> select k from t where id=1 lock in share mode;
    mysql> select k from t where id=1 for update;

如果我们再做修改，改成下面这个逻辑，会怎么样呢？

|事务A|事务B|事务C'|
|:---:|:---:|:---:|
|begin;<br>start transaction with consistent snapshot;|||
||start transaction with consistent snapshot;||
|||start transaction with consistent snapshot;<br>update t set k=k+1 where id = 1;|
||update t set k=k+1 where id = 1;<br>select k from t where id = 1;||
|select k from t where id = 1;<br>commit;|||
||commit;|&nbsp;|

与开始不同的是，事务 C' 更新后并没有提交，而且持有 id=1 这一行的行锁，还未释放，这个时候虽然最新的版本（1,2）已经生成，但是事务B是当前读，而且必须加锁，因此就被锁住了，必须等待事务 C' 释放这个锁，才能继续进行当前读。

![MVCC-5](9.png)

本节信息量有点大，我们来总结一下。可重复读的核心是**一致性读（consistent read）**；而事务更新的时候，只能用当前读，如果当前的记录的行锁被其他事务占用的话，就需要进入锁等待。**隔离级别-读提交（READ COMMITTED）** 和可重读读的逻辑类似，他们的主要区别是：

- 在可重复读隔离级别下，只需要在事务开始的时候创建一致性视图，之后事务里的其他查询都共用这个一致性视图；
- 在读提交隔离级别下，每一个语句执行前都会重新算出一个新的视图。

在读提交的隔离级别下，`satrt transaction with consistent snapshot` 创建快照就失去了意义，相当于普通的 `start transction`。对于开头的事务，我们看到这两个查询语句的创建视图数组实际发生了变化，就是图中的 read view 框。

![MVCC-6](10.png)

这时，事务 A 的查询语句的视图数组是在执行这个语句的时候创建的，时序上 (1,2)、(1,3) 的生成时间都在创建这个视图数组的时刻之前。但是，在这个时刻：

- (1,3) 还没提交，属于情况 1，不可见；
- (1,2) 提交了，属于情况 3，可见。

所以，事务A返回 k=2，事务B 返回查询结果 k=3。

### 脏页刷新

MySQL 在更新或者插入新数据的时候，并不是将数据直接写入磁盘，要是这样每次都访问磁盘势必影响 MySQL 的性能。取而代之的是，MySQL 将更新操作写入 redo log，更新内存页，然后就直接返回客户端，通知更新成功。然后在系统空闲时间，或者内存空间不足，redo log 写满以及系统正常关闭的时候将这些更新操作写入到磁盘。所以当内存页和数据磁盘页内容不一致的时候，我们称这个内存页为**脏页**。内存数据写入到磁盘以后，内存页就跟磁盘数据页内容一致了，称为干净页。

我们再来谈谈 MySQL 脏页刷新的控制策略：

首先，要正确告知 MySQL 所在主机的 IO 能力，这样 InnoDB 在全力刷脏页的时候才知道可以刷多快，由参数 [innodb_io_capacity](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_io_capacity) 控制，设置成 MySQL 所在主机磁盘的 IOPS。磁盘的 IOPS可以通过工具 [fio](https://github.com/axboe/fio) 来测试：

    fio -filename=filename -direct=1 -iodepth 1 -thread -rw=randrw -ioengine=psync -bs=16k -size=500M -numjobs=10 -runtime=10 -group_reporting -name=mytest

其次通过参数 [innodb_max_dirty_pages_pct](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_max_dirty_pages_pct) 控制脏页上线比例，还有 redo log 写入速度一起控制脏页刷新速度。[innodb_flush_neighbors](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_flush_neighbors)用于控制如果脏页的邻居页恰好是脏页，是否要刷新。

### count(*)

count(*)、count(主键 id) 和 count(1) 都表示返回满足条件的结果集的总行数；而 count(字段），则表示返回满足条件的数据行里面，参数“字段”不为 NULL 的总个数。

**对于 count(主键 id) 来说**，InnoDB 引擎会遍历整张表，把每一行的 id 值都取出来，返回给 server 层。server 层拿到 id 后，判断是不可能为空的，就按行累加。

**对于 count(1) 来说**，InnoDB 引擎遍历整张表，但不取值。server 层对于返回的每一行，放一个数字“1”进去，判断是不可能为空的，按行累加。

单看这两个用法的差别的话，你能对比出来，count(1) 执行得要比 count(主键 id) 快。因为从引擎返回 id 会涉及到解析数据行，以及拷贝字段值的操作。

**对于 count(字段) 来说**：

1. 如果这个“字段”是定义为 not null 的话，一行行地从记录里面读出这个字段，判断不能为 null，按行累加；

2. 如果这个“字段”定义允许为 null，那么执行的时候，判断到有可能是 null，还要把值取出来再判断一下，不是 null 才累加。

**但是 count(`*`) 是例外**，并不会把全部字段取出来，而是专门做了优化，不取值。count(*) 肯定不是 null，按行累加。

结论：**按照效率排序的话，count(字段)<count(主键 id)<count(1)≈count(*)，所以我建议你，尽量使用 count(*)。**

### 关于 order by

`order by` 在开发中经常用到，也经常是性能优化的重点，也最可能引起性能问题。事实上，MySQL 处理排序总结来可以有三种情况，以这样一个表来说明问题：

    CREATE TABLE `t` (
    `id` int(11) NOT NULL,
    `city` varchar(16) NOT NULL,
    `name` varchar(16) NOT NULL,
    `age` int(11) NOT NULL,
    `addr` varchar(128) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `city` (`city`)
    ) ENGINE=InnoDB;

这个时候，我们的 SQL 语句可能是这样的：

    select city,name,age from t where city='杭州' order by name limit 1000  ;

#### 全字段排序

我们使用 explain 来看这个语句的执行的情况：

![explain-1](11.png)

Extra 字段中的 `Using filesort` 意思就是用到了排序，MySQL 会给每个线程分配一块叫做 `sort_buffer` 的内存，用于临时存放需要排序的数据，这个 SQL 的执行流程如下：

1. 初始化 sort_buffer，确定放入 name、city、age 这三个字段；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id，也就是图中的 ID_X；
3. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到 city 的值不满足查询条件为止，对应的主键 id 也就是图中的 ID_Y；
6. 对 sort_buffer 中的数据按照字段 name 做快速排序；
7. 按照排序结果取前 1000 行返回给客户端。

我们把这种排序方式称之为 **全字段排序**，是因为在内存块 `sort_buffer` 中排序的时候，select 需要的字段都在内存中，但是有的时候，由于 sort_buffer 不足，也可能需要外部排序，这个时候，就会把要排序的数据存储在临时文件中，使用归并排序对所有数据进行排序。

#### rowid 排序

有的时候，单行长度很大，而且我们还要做排序，这个时候，sort_buffer 极有可能存储不下这么多数据，使用外部排序的时候，分成的临时文件又很多，这样就会极大影响 MySQL 的性能。那么这个时候 MySQL 会怎么做呢？我们可以通过设置 [max_length_for_sort_data](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_max_length_for_sort_data) 参数，让 MySQL 在单行长度大于某个值的时候，采用 `rowid` 算法，我们来看这个算法针对上述的语句的执行过程：

1. 初始化 sort_buffer，确定放入两个字段，即 name 和 id；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id，也就是图中的 ID_X；
3. 到主键 id 索引取出整行，取 name、id 这两个字段，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到不满足 city='杭州’条件为止，也就是图中的 ID_Y；
6. 对 sort_buffer 中的数据按照字段 name 进行排序；
7. 遍历排序结果，取前 1000 行，并按照 id 的值回到原表中取出 city、name 和 age 三个字段返回给客户端。


#### 原数据有序，不用排序

我们知道索引数叶子节点是有序的，如果我们要排序的字段恰好在索引树种已经排好序，那么是不是快很多，让我们对表做以下修改，给表加一个 `(city, name)` 的联合索引：

    alter table t add index city_user(city, name);

这个时候，在执行查询计划如下图：

![sort-2](12.png)

看到已经没有了 `Using filesort` ，因为我们需要的数据在索引树中已经按序排好，MySQL 只要依次拿出来给我们就行，不用再放到 sort_buffer 中排序之后再给我们，这个时候执行流程如下：

1. 从索引 (city,name) 找到第一个满足 city='杭州’条件的主键 id；
2. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，作为结果集的一部分直接返回；
3. 从索引 (city,name) 取下一个记录主键 id；
4. 重复步骤 2、3，直到查到第 1000 条记录，或者是不满足 city='杭州’条件时循环结束。

这个时候，我们可以对表继续进行优化，在查询的时候避免回表，我们添加如下的索引：

    alter table t add index city_user_age(city, name, age);

这个时候，我们再看查询计划：

![sort-3](13.png)

发现使用了新的索引 `city_user_age`（extra 字段中有 `Using Index`），且不再需要回表。


### 原则

1. 对索引字段做函数操作，可能会破坏索引值的有序性，因此优化器就决定放弃走树搜索功能；


### 推荐阅读

1. [一致性读、快照读](http://www.zsythink.net/archives/1436)
