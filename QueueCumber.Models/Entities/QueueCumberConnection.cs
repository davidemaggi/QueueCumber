using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static QueueCumber.Models.Enums;

namespace QueueCumber.Models.Entities
{
    public class QueueCumberConnection : QueueCumberBase
    {
        public Drivers Driver { get; set; }
        public AuthType AuthType { get; set; }

        public ConnectionConfigType ConfigType { get; set; }
        

        public string? ConnectionString { get; set; }
        public string? Name { get; set; }
        public string? Hostname { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public int? Port { get; set; }


    }
}
